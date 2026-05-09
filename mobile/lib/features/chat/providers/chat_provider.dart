import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

final chatProvider = Provider<ChatController>((ref) {
  final controller = ChatController();
  ref.onDispose(() => controller.dispose());
  return controller;
});

class ChatController extends ChangeNotifier {
  IO.Socket? _socket;
  late Box _chatBox;
  
  late stt.SpeechToText _speech;
  late FlutterTts _tts;
  
  bool isListening = false;
  XFile? selectedImage;
  
  List<Map<String, dynamic>> messages = [];
  bool isTyping = false;
  String streamingContent = "";
  int messageCount = 0;
  String? conversationId;
  bool isConnected = false;
  bool isUploading = false;
  String? errorMessage;
  
  final TextEditingController messageController = TextEditingController();
  final ScrollController scrollController = ScrollController();

  ChatController() {
    _initVoice();
    _initChat();
  }

  Future<void> _initChat() async {
    _chatBox = Hive.box('chat_history');
    
    // Check if user changed
    final currentUser = Supabase.instance.client.auth.currentUser;
    final lastUserId = _chatBox.get('last_user_id');

    if (currentUser != null && lastUserId != currentUser.id) {
      // User changed! Clear local history
      await _chatBox.put('messages', []);
      await _chatBox.delete('conversationId');
      await _chatBox.put('last_user_id', currentUser.id);
    }

    _loadHistory();
    _initSocket();
  }

  void _initVoice() async {
    _speech = stt.SpeechToText();
    _tts = FlutterTts();
    await _tts.setLanguage("en-US");
    await _tts.setSpeechRate(0.5);
  }

  Future<void> speak(String text) async {
    await _tts.speak(text);
  }

  void listen() async {
    var status = await Permission.microphone.request();
    if (status.isPermanentlyDenied) {
      errorMessage = 'Microphone permission permanently denied. Please enable it in Settings.';
      notifyListeners();
      await openAppSettings();
      return;
    }
    if (status != PermissionStatus.granted) {
      errorMessage = 'Microphone permission required';
      notifyListeners();
      return;
    }

    if (!isListening) {
      bool available = await _speech.initialize(
        onStatus: (val) => print('onStatus: $val'),
        onError: (val) => print('onError: $val'),
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

  void _loadHistory() {
    _chatBox = Hive.box('chat_history');
    final history = _chatBox.get('messages', defaultValue: []);
    messages = List<Map<String, dynamic>>.from(
      history.map((m) => Map<String, dynamic>.from(m))
    );
    
    // Load persisted conversationId so we resume the same backend thread
    conversationId = _chatBox.get('conversationId');
    
    if (messages.isEmpty) {
      messages.add({'role': 'assistant', 'content': 'Hello! I am LuminaAI, your intelligent assistant. How can I help you today?'});
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
      {'role': 'assistant', 'content': 'History cleared. How can I help you today?'}
    ];
    conversationId = null; // Clear so the backend generates a new thread next time
    notifyListeners();
    _saveHistory();
  }

  Future<List<Map<String, dynamic>>> getConversations() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return [];
    
    // 1. Return cached conversations first for immediate UI update
    final cached = _chatBox.get('conversations_list', defaultValue: []);
    List<Map<String, dynamic>> convs = List<Map<String, dynamic>>.from(cached);

    try {
      // 2. Fetch fresh data from Supabase
      final data = await Supabase.instance.client
          .from('conversations')
          .select()
          .eq('user_id', user.id)
          .order('updated_at', ascending: false);
      
      final freshConvs = List<Map<String, dynamic>>.from(data);
      
      // 3. Update cache if data changed
      await _chatBox.put('conversations_list', freshConvs);
      return freshConvs;
    } catch (e) {
      print('Offline mode: showing cached conversations. Error: $e');
      return convs; // Fallback to cache if offline/error
    }
  }

  Future<void> loadConversation(String id) async {
    try {
      final data = await Supabase.instance.client
          .from('messages')
          .select()
          .eq('conversation_id', id)
          .order('created_at', ascending: true);
      
      messages = [];
      for (var msg in data) {
        messages.add({
          'role': msg['role'],
          'content': msg['content']
        });
      }
      conversationId = id;
      _saveHistory();
      notifyListeners();
      scrollToBottom();
    } catch (e) {
      errorMessage = 'Failed to load conversation: $e';
      notifyListeners();
    }
  }

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
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'txt', 'md'],
      );

      if (result != null && result.files.single.path != null) {
        File file = File(result.files.single.path!);
        
        isUploading = true;
        notifyListeners();

        final session = Supabase.instance.client.auth.currentSession;
        if (session == null) throw Exception("Not logged in");

        final backendUrl = dotenv.env['BACKEND_URL'] ?? const String.fromEnvironment('BACKEND_URL', defaultValue: 'http://10.0.2.2:5000');
        
        var request = http.MultipartRequest('POST', Uri.parse('$backendUrl/api/documents/upload'));
        request.headers['Authorization'] = 'Bearer ${session.accessToken}';
        request.files.add(await http.MultipartFile.fromPath('file', file.path));

        var response = await request.send();

        if (response.statusCode == 201) {
          messages.add({
            'role': 'assistant',
            'content': '✅ Document **${result.files.single.name}** uploaded successfully! I have read it and you can now ask me questions about it.'
          });
        } else {
          errorMessage = 'Failed to upload document. Status: ${response.statusCode}';
        }
      }
    } catch (e) {
      errorMessage = 'Error uploading file: $e';
    } finally {
      isUploading = false;
      notifyListeners();
      _saveHistory();
      scrollToBottom();
    }
  }

  void _initSocket() {
    final backendUrl = dotenv.env['BACKEND_URL'] ?? const String.fromEnvironment('BACKEND_URL', defaultValue: 'http://10.0.2.2:5000');
    
    _socket = IO.io(backendUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build());

    _socket!.connect();

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
      notifyListeners();
    });

    _socket!.on('conversation_created', (data) {
      conversationId = data['id'];
      _saveHistory(); // Save immediately to local storage
      notifyListeners();
    });

    _socket!.on('stream_chunk', (data) {
      isTyping = true;
      streamingContent += data['chunk'];
      notifyListeners();
      scrollToBottom();
    });

    _socket!.on('stream_end', (data) {
      messages.add({
        'role': 'assistant',
        'content': streamingContent,
      });
      speak(streamingContent);
      streamingContent = "";
      isTyping = false;
      notifyListeners();
      _saveHistory();
      scrollToBottom();
    });

    _socket!.on('chat_error', (data) {
      errorMessage = data['error'];
      isTyping = false;
      notifyListeners();
    });
  }

  void sendMessage({VoidCallback? onLimitReached}) async {
    if (messageCount >= 50) {
      if (onLimitReached != null) onLimitReached();
      return;
    }

    final text = messageController.text.trim();
    if (text.isEmpty && selectedImage == null) return;
    
    final user = Supabase.instance.client.auth.currentUser;
    String? base64Image;

    if (selectedImage != null) {
      final bytes = await File(selectedImage!.path).readAsBytes();
      base64Image = base64Encode(bytes);
    }
    
    _socket?.emit('chat_message', {
      'message': text,
      'userId': user?.id,
      'conversation_id': conversationId,
      'image': base64Image,
    });

    if (text.isNotEmpty) {
      messages.add({'role': 'user', 'content': text});
    }
    if (selectedImage != null) {
      messages.add({'role': 'user', 'content': '[Image Attached]', 'imagePath': selectedImage!.path});
    }
    
    messageController.clear();
    selectedImage = null;
    isTyping = true;
    streamingContent = "";
    messageCount++;
    notifyListeners();
    
    _saveHistory();
    scrollToBottom();
  }

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

  @override
  void dispose() {
    _socket?.dispose();
    messageController.dispose();
    scrollController.dispose();
    super.dispose();
  }
}
