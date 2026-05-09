import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:mobile/features/subscription/presentation/upgrade_modal.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/features/chat/providers/chat_provider.dart';
import 'package:mobile/features/chat/presentation/documents_screen.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';
import 'package:mobile/features/chat/presentation/settings_screen.dart';
import 'package:mobile/features/chat/presentation/integrations_screen.dart';

final drawerSearchProvider = StateProvider<String>((ref) => "");

class ChatScreen extends ConsumerWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatState = ref.watch(chatProvider);
    final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();

    // Handle error showing gracefully
    ref.listen<ChatController>(chatProvider, (previous, next) {
      if (next.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.errorMessage!),
            backgroundColor: Colors.red,
          ),
        );
        Future.microtask(() => ref.read(chatProvider).clearError());
      }
    });

    return ListenableBuilder(
      listenable: chatState,
      builder: (context, child) {
        return Scaffold(
          key: scaffoldKey,
          backgroundColor: const Color(0xFF020617),
          drawer: _buildDrawer(context, ref),
          appBar: _buildAppBar(scaffoldKey, chatState.isConnected),
          body: Stack(
            children: [
          // Background Glows
          Positioned(
            top: 200,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          
          Column(
            children: [
              Expanded(
                child: ListView.builder(
                  controller: chatState.scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                  itemCount: chatState.messages.length + (chatState.isTyping ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index < chatState.messages.length) {
                      final msg = chatState.messages[index];
                      return _buildChatBubble(context, msg['role'] == 'user', msg['content'], imagePath: msg['imagePath']);
                    } else {
                      return _buildChatBubble(context, false, chatState.streamingContent.isEmpty ? "..." : chatState.streamingContent, isStreaming: true);
                    }
                  },
                ),
              ),
              if (chatState.selectedImage != null) _buildImagePreview(context, ref, chatState.selectedImage!),
              _buildInputArea(context, ref, chatState),
            ],
          ),
        ],
      ),
    );
  });
}

  Widget _buildImagePreview(BuildContext context, WidgetRef ref, XFile image) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.file(
              File(image.path),
              height: 100,
              width: 100,
              fit: BoxFit.cover,
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: () => ref.read(chatProvider).setImage(null),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                child: const Icon(LucideIcons.x, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer(BuildContext context, WidgetRef ref) {
    return Drawer(
      backgroundColor: const Color(0xFF020617),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)]),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.bot, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 16),
                  Text('LuminaAI', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)),
                ],
              ),
            ),
            const Divider(color: Colors.white10),
            _buildDrawerItem(LucideIcons.plus, 'New Chat', () {
              ref.read(chatProvider).clearHistory();
              Navigator.pop(context);
            }, color: const Color(0xFF8B5CF6)),
            const Divider(color: Colors.white10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: TextField(
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search chats...',
                  hintStyle: const TextStyle(color: Colors.white24),
                  prefixIcon: const Icon(LucideIcons.search, color: Colors.white24, size: 18),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                ),
                onChanged: (val) {
                  // We use a local state for the drawer's search query
                  // For simplicity in this ConsumerWidget, we'll use a StateProvider or just trigger a refresh
                  ref.read(drawerSearchProvider.notifier).state = val.toLowerCase();
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 24, top: 8, bottom: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Recent', style: GoogleFonts.inter(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ),
            Expanded(
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: ref.read(chatProvider).getConversations(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6)));
                  }
                  
                  final searchQuery = ref.watch(drawerSearchProvider);
                  final allConversations = snapshot.data ?? [];
                  final filteredConversations = allConversations.where((conv) {
                    final title = (conv['title'] ?? 'New Conversation').toString().toLowerCase();
                    return title.contains(searchQuery);
                  }).toList();

                  if (filteredConversations.isEmpty) {
                    return Center(child: Text(searchQuery.isEmpty ? 'No previous chats.' : 'No results found.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 14)));
                  }

                  return ListView.builder(
                    padding: EdgeInsets.zero,
                    itemCount: filteredConversations.length,
                    itemBuilder: (context, index) {
                      final conv = filteredConversations[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 24),
                        leading: const Icon(LucideIcons.messageSquare, color: Colors.white70, size: 20),
                        title: Text(
                          conv['title'] ?? 'New Conversation',
                          style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () {
                          Navigator.pop(context); // Close drawer
                          ref.read(chatProvider).loadConversation(conv['id']);
                        },
                      );
                    },
                  );
                },
              ),
            ),
            const Divider(color: Colors.white10),
            _buildDrawerItem(LucideIcons.fileText, 'Document QA', () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const DocumentsScreen()));
            }),
            _buildDrawerItem(LucideIcons.workflow, 'Integrations', () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const IntegrationsScreen()));
            }),
            _buildDrawerItem(LucideIcons.settings, 'Settings', () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
            }),
            _buildDrawerItem(LucideIcons.logOut, 'Sign Out', () async {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: const Color(0xFF1E293B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  title: Text('Sign Out?', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                  content: Text('Are you sure you want to sign out of LuminaAI?', style: GoogleFonts.inter(color: Colors.white70)),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () async {
                        await Supabase.instance.client.auth.signOut();
                        if (context.mounted) {
                          Navigator.pushAndRemoveUntil(
                            context,
                            MaterialPageRoute(builder: (_) => LoginScreen()),
                            (route) => false,
                          );
                        }
                      },
                      child: const Text('Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            }, color: Colors.redAccent),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerItem(IconData icon, String title, VoidCallback onTap, {Color color = Colors.white}) {
    return ListTile(
      leading: Icon(icon, color: color.withOpacity(0.7), size: 22),
      title: Text(title, style: GoogleFonts.inter(color: color, fontWeight: FontWeight.w500)),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
    );
  }

  PreferredSizeWidget _buildAppBar(GlobalKey<ScaffoldState> key, bool isConnected) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      flexibleSpace: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            color: const Color(0xFF020617).withOpacity(0.7),
          ),
        ),
      ),
      leading: IconButton(
        icon: const Icon(LucideIcons.menu, color: Colors.white),
        onPressed: () => key.currentState?.openDrawer(),
      ),
      title: Row(
        children: [
          Text(
            'LuminaAI',
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(width: 8),
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isConnected ? Colors.greenAccent : Colors.redAccent,
            ),
          )
        ],
      ),
      actions: [
        Builder(
          builder: (context) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFF8B5CF6).withOpacity(0.2),
                child: const Icon(LucideIcons.user, size: 16, color: Color(0xFF8B5CF6)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildChatBubble(BuildContext context, bool isUser, String content, {bool isStreaming = false, String? imagePath}) {
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF8B5CF6) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: const Radius.circular(20),
            bottomLeft: Radius.circular(isUser ? 20 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 20),
          ),
          border: isUser ? null : Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (imagePath != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(
                    File(imagePath),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            if (content.isNotEmpty && content != '[Image Attached]')
              isUser 
                ? Text(content, style: GoogleFonts.inter(color: Colors.white, fontSize: 15, height: 1.5))
                : content.contains('[SYSTEM:')
                    ? _buildSystemCard(context, content)
                    : MarkdownBody(
                        data: content,
                        styleSheet: MarkdownStyleSheet(
                          p: GoogleFonts.inter(color: const Color(0xFFE2E8F0), fontSize: 15, height: 1.5),
                          code: GoogleFonts.firaCode(backgroundColor: Colors.black26, color: const Color(0xFFFACC15), fontSize: 13),
                          codeblockDecoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemCard(BuildContext context, String content) {
    bool isEmail = content.toLowerCase().contains('email');
    bool isTask = content.toLowerCase().contains('task') || content.toLowerCase().contains('action');
    
    String title = isEmail ? 'Email Draft' : (isTask ? 'Task Extracted' : 'System Action');
    IconData icon = isEmail ? LucideIcons.mail : (isTask ? LucideIcons.checkCircle : LucideIcons.cpu);
    Color color = isEmail ? const Color(0xFF3B82F6) : const Color(0xFF10B981);

    // Remove the [SYSTEM: ...] tag from the display text
    String cleanContent = content.replaceAll(RegExp(r'\[SYSTEM:.*?\]'), '').trim();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: Colors.black26,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              border: Border(bottom: BorderSide(color: color.withOpacity(0.2))),
            ),
            child: Row(
              children: [
                Icon(icon, color: color, size: 18),
                const SizedBox(width: 8),
                Text(title, style: GoogleFonts.outfit(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: MarkdownBody(
              data: cleanContent,
              styleSheet: MarkdownStyleSheet(
                p: GoogleFonts.inter(color: Colors.white70, fontSize: 14, height: 1.5),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: cleanContent));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied to clipboard')));
                  },
                  icon: const Icon(LucideIcons.copy, size: 16, color: Colors.white54),
                  label: Text('Copy', style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
                ),
                if (isEmail)
                  TextButton.icon(
                    onPressed: () {
                       Clipboard.setData(ClipboardData(text: cleanContent));
                       ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied! Open your Mail app.')));
                    },
                    icon: Icon(LucideIcons.externalLink, size: 16, color: color),
                    label: Text('Open App', style: GoogleFonts.inter(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea(BuildContext context, WidgetRef ref, ChatController chatState) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, const Color(0xFF020617).withOpacity(0.8)],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        icon: chatState.isUploading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6)),
                              )
                            : const Icon(LucideIcons.filePlus, color: Color(0xFF64748B), size: 20),
                        onPressed: chatState.isUploading
                            ? null
                            : () => ref.read(chatProvider).uploadFile(),
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.image, color: Color(0xFF64748B), size: 20),
                        onPressed: () async {
                           var status = await Permission.photos.request();
                           if (status.isPermanentlyDenied) {
                             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gallery permission permanently denied. Opening Settings...')));
                             await openAppSettings();
                             return;
                           }
                           if (status != PermissionStatus.granted) {
                             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gallery permission required')));
                             return;
                           }
                           final ImagePicker picker = ImagePicker();
                           final XFile? selected = await picker.pickImage(
                             source: ImageSource.gallery,
                             imageQuality: 70,
                           );
                           if (selected != null) {
                             ref.read(chatProvider).setImage(selected);
                           }
                        },
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.camera, color: Color(0xFF64748B), size: 20),
                        onPressed: () async {
                           var status = await Permission.camera.request();
                           if (status.isPermanentlyDenied) {
                             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Camera permission permanently denied. Opening Settings...')));
                             await openAppSettings();
                             return;
                           }
                           if (status != PermissionStatus.granted) {
                             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Camera permission required')));
                             return;
                           }
                           final ImagePicker picker = ImagePicker();
                           final XFile? photo = await picker.pickImage(
                             source: ImageSource.camera,
                             imageQuality: 70,
                           );
                           if (photo != null) {
                             ref.read(chatProvider).setImage(photo);
                           }
                        },
                      ),
                      Expanded(
                        child: TextField(
                          controller: chatState.messageController,
                          style: const TextStyle(color: Colors.white),
                          onSubmitted: (_) => chatState.sendMessage(onLimitReached: () {
                            showDialog(
                              context: context,
                              barrierDismissible: false,
                              builder: (context) => const UpgradeModal(),
                            );
                          }),
                          decoration: const InputDecoration(
                            hintText: 'Message LuminaAI...',
                            hintStyle: TextStyle(color: Color(0xFF64748B), fontSize: 14),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(horizontal: 8),
                          ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          chatState.isListening ? LucideIcons.mic : LucideIcons.micOff,
                          color: chatState.isListening ? const Color(0xFF8B5CF6) : const Color(0xFF64748B),
                          size: 20
                        ),
                        onPressed: () {
                          final state = ref.read(chatProvider);
                          if (!state.isListening) {
                            state.listen();
                            _showListeningBottomSheet(context, ref);
                          } else {
                            state.listen();
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => chatState.sendMessage(onLimitReached: () {
               showDialog(
                 context: context,
                 barrierDismissible: false,
                 builder: (context) => const UpgradeModal(),
               );
            }),
            child: Container(
              height: 52,
              width: 52,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)]),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: const Color(0xFF8B5CF6).withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))
                ],
              ),
              child: const Icon(LucideIcons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  void _showListeningBottomSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      builder: (ctx) {
        return ListenableBuilder(
          listenable: ref.read(chatProvider),
          builder: (context, child) {
            final chatState = ref.read(chatProvider);
            if (!chatState.isListening) {
              Future.microtask(() {
                if (Navigator.of(ctx).canPop()) {
                  Navigator.of(ctx).pop();
                }
              });
            }

            return Container(
              height: 350,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(40)),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Listening...', style: GoogleFonts.outfit(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Text('Speak now. The AI is processing your voice.', style: GoogleFonts.inter(color: Colors.white54, fontSize: 14)),
                  const SizedBox(height: 40),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(6, (index) => _WaveBar(index: index)),
                  ),
                  const SizedBox(height: 50),
                  GestureDetector(
                    onTap: () {
                      ref.read(chatProvider).listen(); // stops listening
                      if (Navigator.of(ctx).canPop()) {
                        Navigator.of(ctx).pop();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.1),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                      ),
                      child: const Icon(LucideIcons.square, color: Colors.redAccent, size: 24),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _WaveBar extends StatefulWidget {
  final int index;
  const _WaveBar({required this.index});

  @override
  State<_WaveBar> createState() => _WaveBarState();
}

class _WaveBarState extends State<_WaveBar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300 + (widget.index * 150)),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: 8,
          height: 15 + (_controller.value * 45),
          decoration: BoxDecoration(
            color: const Color(0xFF8B5CF6),
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF8B5CF6).withOpacity(0.4),
                blurRadius: 8,
                spreadRadius: _controller.value * 2,
              )
            ],
          ),
        );
      },
    );
  }
}
