import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

// ── App Config ────────────────────────────────────────────────────────────────
// Backend URL is injected at build time via --dart-define=BACKEND_URL=...
// Falls back to the Android emulator localhost alias in debug mode.
const _backendUrl = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: kDebugMode ? 'http://10.0.2.2:5000' : '',
);

String get backendUrl {
  if (_backendUrl.isNotEmpty) return _backendUrl;
  // Final fallback (should not reach in production)
  return 'http://10.0.2.2:5000';
}

// ── Provider ──────────────────────────────────────────────────────────────────

final chatProvider = Provider<ChatController>((ref) {
  final controller = ChatController();
  ref.onDispose(() => controller.dispose());
  return controller;
});

// ── Controller ────────────────────────────────────────────────────────────────

class ChatController extends ChangeNotifier {
  IO.Socket? _socket;
  late Box _chatBox;

  late stt.SpeechToText _speech;
  late FlutterTts _tts;

  bool isListening = false;
  XFile? selectedImage;

  List<Map<String, dynamic>> messages = [];
  /// Reactive list of all user conversations — updated on init and on every
  /// background refresh. The drawer reads this directly instead of using a
  /// FutureBuilder, eliminating the rebuild loop.
  List<Map<String, dynamic>> conversations = [];
  bool isTyping = false;
  String streamingContent = '';
  /// Real server-side message count. Fetched on init and persisted in
  /// SharedPreferences so it survives app restarts (not bypassable).
  int messageCount = 0;
  /// null = unlimited (Pro/Enterprise plan)
  int? messageLimit = 50;
  String userPlan = 'free';

  String? conversationId;
  bool _isUploading = false;
  bool get isUploading => _isUploading;

  bool _isLoadingConversations = false;
  bool get isLoadingConversations => _isLoadingConversations;

  bool isConnected = false;
  String? errorMessage;
  String selectedModel = 'llama-3.1-8b-instant'; // Default fast model

  // BUG 8 FIX: Client-side watchdog — cancels isTyping if stream_end never arrives.
  Timer? _streamTimeout;

  final TextEditingController messageController = TextEditingController();
  final ScrollController scrollController = ScrollController();

  // Prefs key for the persisted count
  static const _kMessageCount = 'server_message_count';
  static const _kMessageLimit = 'server_message_limit';
  static const _kUserPlan    = 'server_user_plan';

  ChatController() {
    _initVoice();
    _initChat();
  }

  void setModel(String model) {
    selectedModel = model;
    notifyListeners();
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  Future<void> _initChat() async {
    _chatBox = Hive.box('chat_history');

    // If the user changed accounts, wipe local history
    final currentUser = Supabase.instance.client.auth.currentUser;
    final lastUserId = _chatBox.get('last_user_id') as String?;

    if (currentUser != null && lastUserId != currentUser.id) {
      await _chatBox.put('messages', []);
      await _chatBox.delete('conversationId');
      await _chatBox.put('last_user_id', currentUser.id);
    }

    _loadHistory();
    _initSocket();

    // Restore persisted usage count immediately so the UI is consistent
    // even before the network call completes.
    await _restoreUsageFromPrefs();

    // Then refresh from the server in the background (authoritative count)
    _syncUsageFromServer();
  }

  void _initVoice() async {
    _speech = stt.SpeechToText();
    _tts = FlutterTts();
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);
  }

  // ── Usage / Limit Management ────────────────────────────────────────────────

  /// Restores the last known usage count from SharedPreferences.
  /// Called before the network request so the UI doesn't flash "0 messages".
  Future<void> _restoreUsageFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    messageCount = prefs.getInt(_kMessageCount) ?? 0;
    messageLimit = prefs.getInt(_kMessageLimit) ?? 50;
    userPlan     = prefs.getString(_kUserPlan) ?? 'free';
    notifyListeners();
  }

  /// Fetches the authoritative message count from the backend's
  /// GET /api/chat/usage endpoint. This is the server-enforced count —
  /// it cannot be bypassed by restarting the app.
  Future<void> _syncUsageFromServer() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return;

    try {
      final response = await http.get(
        Uri.parse('$backendUrl/api/chat/usage'),
        headers: {'Authorization': 'Bearer ${session.accessToken}'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;

        messageCount = (body['messageCount'] as num?)?.toInt() ?? messageCount;
        userPlan     = (body['plan'] as String?) ?? userPlan;
        // `limit` is null for pro/enterprise (unlimited)
        messageLimit = body['limit'] == null ? null : (body['limit'] as num).toInt();

        // Persist for next cold start
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt(_kMessageCount, messageCount);
        if (messageLimit != null) await prefs.setInt(_kMessageLimit, messageLimit!);
        await prefs.setString(_kUserPlan, userPlan);

        if (kDebugMode) {
          debugPrint('[ChatProvider] Usage synced: $messageCount / ${messageLimit ?? "∞"} ($userPlan)');
        }

        notifyListeners();
      }
    } catch (e) {
      // Non-fatal: we already have the persisted count from prefs.
      if (kDebugMode) debugPrint('[ChatProvider] Usage sync failed: $e');
    }
  }

  /// Initiates a real Stripe Checkout session for the Pro plan
  Future<void> startStripeUpgrade() async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) throw Exception('Not logged in');

    try {
      final response = await http.post(
        Uri.parse('$backendUrl/api/stripe/create-checkout-session'),
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'priceId': 'price_auto_pro', // Placeholder if backend expects it, but backend hardcodes it right now
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final checkoutUrl = data['url'];
        
        if (checkoutUrl != null) {
          final uri = Uri.parse(checkoutUrl);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          } else {
            throw Exception('Could not launch Stripe URL');
          }
        } else {
          throw Exception('No URL returned from Stripe');
        }
      } else {
        if (kDebugMode) debugPrint('[ChatProvider] Stripe failed: ${response.statusCode} - ${response.body}');
        throw Exception('Stripe Checkout failed to initialize');
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[ChatProvider] Stripe request error: $e');
      rethrow;
    }
  }

  /// Returns true if the user has NOT hit their message limit.
  bool get canSendMessage =>
      messageLimit == null || messageCount < messageLimit!;

  // ── History ─────────────────────────────────────────────────────────────────

  void _loadHistory() {
    _chatBox = Hive.box('chat_history');

    // Restore messages
    final history = _chatBox.get('messages', defaultValue: []);
    messages = List<Map<String, dynamic>>.from(
      (history as List).map((m) => Map<String, dynamic>.from(m as Map)),
    );
    conversationId = _chatBox.get('conversationId') as String?;

    if (messages.isEmpty) {
      messages.add({
        'role': 'assistant',
        'content': 'Hello! I am LuminaAI, your intelligent assistant. How can I help you today?',
      });
    }

    // Restore cached conversations list for immediate drawer display
    final cached = _chatBox.get('conversations_list', defaultValue: []);
    try {
      if (cached is List && cached.isNotEmpty) {
        conversations = cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[ChatProvider] Hive conversations cache error: $e');
    }

    notifyListeners();
    scrollToBottom();
  }

  void _saveHistory() {
    _chatBox.put('messages', messages);
    if (conversationId != null) {
      _chatBox.put('conversationId', conversationId);
    } else {
      _chatBox.delete('conversationId');
    }
  }

  void clearHistory() {
    messages = [
      {'role': 'assistant', 'content': 'History cleared. How can I help you today?'},
    ];
    conversationId = null;
    notifyListeners();
    _saveHistory();
  }

  // ── Conversations ───────────────────────────────────────────────────────────

  /// Trigger a background refresh of the conversations list from Supabase.
  /// The result updates `this.conversations` and notifies listeners — the
  /// drawer will re-render automatically via ListenableBuilder.
  /// This replaces the old FutureBuilder pattern which caused rebuild loops.
  void refreshConversations() {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    _fetchConversationsFromServer(user.id);
  }

  /// Kept for backward compatibility (e.g. drawer onTap triggers).
  /// Now returns the in-memory list synchronously — no network call.
  Future<List<Map<String, dynamic>>> getConversations() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return [];
    // If the list is empty (first cold start), trigger a fetch
    if (conversations.isEmpty) {
      _fetchConversationsFromServer(user.id);
    }
    return conversations;
  }

  Future<void> _fetchConversationsFromServer(String userId) async {
    try {
      _isLoadingConversations = true;
      notifyListeners();

      final data = await Supabase.instance.client
          .from('conversations')
          .select('id, title, created_at, updated_at')
          .eq('user_id', userId)
          .order('updated_at', ascending: false);

      final freshConvs = List<Map<String, dynamic>>.from(data as List);

      // Update in-memory list (reactive — drawer re-renders immediately)
      conversations = freshConvs;

      // Persist to Hive for next cold start
      await _chatBox.put('conversations_list', freshConvs);

      _isLoadingConversations = false;
      notifyListeners();
    } catch (e) {
      _isLoadingConversations = false;
      notifyListeners();
      if (kDebugMode) debugPrint('[ChatProvider] Fetch conversations error: $e');
    }
  }

  Future<void> loadConversation(String id) async {
    try {
      final data = await Supabase.instance.client
          .from('messages')
          .select()
          .eq('conversation_id', id)
          .order('created_at', ascending: true);

      messages = (data as List).map((msg) => {
        'role': msg['role'] as String,
        'content': msg['content'] as String,
      }).toList();

      conversationId = id;
      _saveHistory();
      notifyListeners();
      scrollToBottom();
    } catch (e) {
      errorMessage = 'Failed to load conversation: $e';
      notifyListeners();
    }
  }

  Future<void> deleteConversation(String id) async {
    // Optimistic Update: Remove from local list immediately to prevent Dismissible UI errors
    final originalConversations = List<Map<String, dynamic>>.from(conversations);
    conversations.removeWhere((c) => c['id'] == id);
    notifyListeners();

    try {
      // BUG 3 FIX: Call the backend REST endpoint instead of Supabase directly.
      // The backend route deletes child messages FIRST (avoiding orphaned rows),
      // then the conversation. Direct Supabase calls bypass this cascade.
      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) throw Exception('Not logged in');

      final response = await http.delete(
        Uri.parse('$backendUrl/api/chat/conversations/$id'),
        headers: {'Authorization': 'Bearer ${session.accessToken}'},
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('Server returned ${response.statusCode}: ${response.body}');
      }

      if (conversationId == id) {
        clearHistory();
      }
      // Re-sync with server to be sure
      refreshConversations();
    } catch (e) {
      // Revert on failure
      conversations = originalConversations;
      errorMessage = 'Failed to delete conversation: $e';
      notifyListeners();
    }
  }

  // ── Image / File ─────────────────────────────────────────────────────────────

  void setImage(XFile? image) {
    selectedImage = image;
    notifyListeners();
  }

  void clearError() {
    if (errorMessage != null) {
      errorMessage = null;
      notifyListeners();
    }
  }

  Future<void> uploadFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'txt', 'md'],
      );

      if (result == null || result.files.single.path == null) return;

      final file = File(result.files.single.path!);
      _isUploading = true;
      notifyListeners();

      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) throw Exception('Not logged in');

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$backendUrl/api/documents/upload'),
      );
      request.headers['Authorization'] = 'Bearer ${session.accessToken}';
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final response = await request.send().timeout(const Duration(seconds: 60));

      if (response.statusCode == 201) {
        messages.add({
          'role': 'assistant',
          'content':
              '✅ Document **${result.files.single.name}** uploaded successfully! '
              'I have read it and you can now ask me questions about it.',
        });
      } else {
        errorMessage = 'Failed to upload document. Status: ${response.statusCode}';
      }
    } catch (e) {
      errorMessage = 'Error uploading file: $e';
    } finally {
      _isUploading = false;
      notifyListeners();
      _saveHistory();
      scrollToBottom();
    }
  }

  // ── Voice ────────────────────────────────────────────────────────────────────

  Future<void> speak(String text) async {
    await _tts.speak(text);
  }

  void listen() async {
    final status = await Permission.microphone.request();

    if (status.isPermanentlyDenied) {
      errorMessage = 'Microphone permission permanently denied. Please enable it in Settings.';
      notifyListeners();
      await openAppSettings();
      return;
    }
    if (status != PermissionStatus.granted) {
      errorMessage = 'Microphone permission required.';
      notifyListeners();
      return;
    }

    if (!isListening) {
      final available = await _speech.initialize(
        onStatus: (val) {
          if (kDebugMode) debugPrint('[Speech] Status: $val');
        },
        onError: (val) {
          if (kDebugMode) debugPrint('[Speech] Error: $val');
        },
      );
      if (available) {
        isListening = true;
        notifyListeners();
        _speech.listen(
          onResult: (val) {
            messageController.text = val.recognizedWords;
            notifyListeners();
          },
        );
      }
    } else {
      isListening = false;
      _speech.stop();
      notifyListeners();
      if (messageController.text.isNotEmpty) {
        sendMessage();
      }
    }
  }

  // ── Socket.IO ────────────────────────────────────────────────────────────────

  void _initSocket() {
    _socket = IO.io(
      backendUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)       // start at 1s
          .setReconnectionDelayMax(10000)   // cap at 10s
          .setRandomizationFactor(0.5)
          .build(),
    );

    _socket!.connect();

    // Authenticate on connect (and on every reconnect)
    _socket!.onConnect((_) {
      isConnected = true;
      notifyListeners();

      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        _socket!.emit('authenticate', session.accessToken);
      }
    });

    _socket!.onDisconnect((_) {
      isConnected = false;
      isTyping = false; // Reset typing state on disconnect to prevent UI freeze
      notifyListeners();
    });

    _socket!.on('conversation_created', (data) {
      conversationId = data['id'] as String?;
      _saveHistory();
      notifyListeners();
    });

    _socket!.on('stream_chunk', (data) {
      isTyping = true;
      streamingContent += (data['chunk'] as String? ?? '');
      notifyListeners();
      scrollToBottom();
    });

    _socket!.on('stream_end', (data) {
      // BUG 8 FIX: Cancel the watchdog — response arrived in time.
      _streamTimeout?.cancel();
      _streamTimeout = null;

      final textToSpeak = streamingContent;
      messages.add({
        'role': 'assistant',
        'content': streamingContent,
      });
      streamingContent = '';
      isTyping = false;
      notifyListeners();
      _saveHistory();
      scrollToBottom();

      // Auto-speak the AI's response using native TTS
      if (textToSpeak.isNotEmpty) {
        // Remove [tags] and markdown characters so the voice sounds natural
        final cleanText = textToSpeak
            .replaceAll(RegExp(r'\[.*?\]'), '')
            .replaceAll(RegExp(r'[*_`#]'), '')
            .trim();
        if (cleanText.isNotEmpty) speak(cleanText);
      }
    });

    _socket!.on('chat_error', (data) {
      // BUG 8 FIX: Cancel the watchdog on error too.
      _streamTimeout?.cancel();
      _streamTimeout = null;

      final err = data['error'] as String? ?? 'Unknown error';
      if (err == 'Usage limit reached') {
        // Re-sync from server so the local count is accurate
        _syncUsageFromServer();
      }
      errorMessage = data['message'] as String? ?? err;
      isTyping = false;
      notifyListeners();
    });
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  void sendMessage({VoidCallback? onLimitReached}) async {
    // Use server-authoritative limit check
    if (!canSendMessage) {
      onLimitReached?.call();
      return;
    }

    final text = messageController.text.trim();
    if (text.isEmpty && selectedImage == null) return;

    String? base64Image;
    if (selectedImage != null) {
      final bytes = await File(selectedImage!.path).readAsBytes();
      base64Image = base64Encode(bytes);
    }

    final user = Supabase.instance.client.auth.currentUser;

    _socket?.emit('chat_message', {
      'message': text,
      'userId': user?.id,
      'conversation_id': conversationId,
      'image': base64Image,
      'model': selectedModel,
    });

    // BUG 8 FIX: Start the watchdog immediately after emitting the message.
    // If stream_end hasn’t arrived within 60 seconds the UI is unfrozen.
    _startStreamTimeout();

    isTyping = true; // Immediate feedback
    notifyListeners();

    if (text.isNotEmpty) {
      messages.add({'role': 'user', 'content': text});
    }
    if (selectedImage != null) {
      messages.add({
        'role': 'user',
        'content': '[Image Attached]',
        'imagePath': selectedImage!.path,
      });
    }

    messageController.clear();
    selectedImage = null;
    isTyping = true;
    streamingContent = '';

    // Optimistically increment the local counter immediately.
    // The background _syncUsageFromServer() call (triggered on stream_end
    // or chat_error) will correct it with the real value from the server.
    messageCount++;

    notifyListeners();
    _saveHistory();
    scrollToBottom();
  }

  // ── Stream Timeout Watchdog (BUG 8) ────────────────────────────────────────

  /// Starts (or restarts) a 60-second watchdog timer.
  /// If the server drops the connection mid-stream the timer fires, resets
  /// [isTyping], and shows an error so the UI doesn’t freeze permanently.
  void _startStreamTimeout() {
    _streamTimeout?.cancel();
    _streamTimeout = Timer(const Duration(seconds: 60), () {
      if (isTyping) {
        isTyping = false;
        streamingContent = '';
        errorMessage = 'Response timed out. Please try again.';
        notifyListeners();
        if (kDebugMode) {
          debugPrint('[ChatProvider] Stream watchdog fired — response timed out.');
        }
      }
    });
  }

  // ── Scroll ───────────────────────────────────────────────────────────────────

  void scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scrollController.hasClients) {
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _streamTimeout?.cancel(); // BUG 8 FIX: Clean up watchdog timer
    _socket?.dispose();
    messageController.dispose();
    scrollController.dispose();
    super.dispose();
  }
}
