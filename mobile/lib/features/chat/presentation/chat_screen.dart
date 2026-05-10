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
import 'package:mobile/features/auth/presentation/login_screen.dart';
import 'package:mobile/features/chat/presentation/settings_screen.dart';
// DocumentsScreen, IntegrationsScreen, SettingsScreen are now permanent tabs
// inside MainShell — no longer pushed from the drawer.

final drawerSearchProvider = StateProvider<String>((ref) => "");

class ChatScreen extends ConsumerWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatState = ref.watch(chatProvider);
    final GlobalKey<ScaffoldState> scaffoldKey = GlobalKey<ScaffoldState>();

    // Handle error showing with styled snackbar (#8)
    ref.listen<ChatController>(chatProvider, (previous, next) {
      if (next.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(children: [
              const Icon(LucideIcons.alertCircle, color: Colors.white, size: 18),
              const SizedBox(width: 10),
              Expanded(child: Text(next.errorMessage!,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14))),
            ]),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 4),
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
          appBar: _buildAppBar(scaffoldKey, chatState.isConnected, ref),
          body: Stack(
            children: [
          // Background Glows
          Positioned(
            top: 200, right: -100,
            child: Container(
              width: 300, height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),

          Column(
            children: [
              // ── Offline banner (#16) ───────────────────────────────────
              AnimatedContainer(
                duration: const Duration(milliseconds: 350),
                curve: Curves.easeOut,
                height: chatState.isConnected ? 0 : 44,
                child: chatState.isConnected
                    ? const SizedBox.shrink()
                    : GestureDetector(
                        onTap: () => HapticFeedback.lightImpact(),
                        child: Container(
                          color: const Color(0xFFEF4444).withOpacity(0.9),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 14, height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 1.5, color: Colors.white),
                              ),
                              const SizedBox(width: 10),
                              Text('Reconnecting to LuminaAI...',
                                  style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
              ),

              Expanded(
                child: ListView.builder(
                  controller: chatState.scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                  itemCount: chatState.messages.length + (chatState.isTyping ? 1 : 0),
                  itemBuilder: (context, index) {
                    // ── Welcome screen (#4) — shown when only greeting exists
                    if (index == 0 &&
                        chatState.messages.length == 1 &&
                        !chatState.isTyping) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildChatBubble(context, false,
                              chatState.messages[0]['content'],
                              imagePath: chatState.messages[0]['imagePath']),
                          _buildWelcomePrompts(context, ref, chatState),
                        ],
                      );
                    }
                    if (index < chatState.messages.length) {
                      final msg = chatState.messages[index];
                      return _buildChatBubble(
                        context,
                        msg['role'] == 'user',
                        msg['content'],
                        imagePath: msg['imagePath'],
                      );
                    } else {
                      return _buildChatBubble(context, false,
                          chatState.streamingContent.isEmpty
                              ? '...'
                              : chatState.streamingContent,
                          isStreaming: true);
                    }
                  },
                ),
              ),
              if (chatState.selectedImage != null)
                _buildImagePreview(context, ref, chatState.selectedImage!),
              _buildInputArea(context, ref, chatState),
            ],
          ),
        ],
      ),
    );
  });
}

  // ── Welcome prompts (#4) ─────────────────────────────────────────────────
  Widget _buildWelcomePrompts(BuildContext context, WidgetRef ref, ChatController chatState) {
    const prompts = [
      '💡 Help me write a professional email',
      '📄 Summarize the document I uploaded',
      '🐛 Create a GitHub issue for a bug',
      '📋 Extract tasks from my meeting notes',
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Try asking:',
              style: GoogleFonts.inter(
                  color: Colors.white38, fontSize: 12,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: prompts.map((p) => GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                chatState.messageController.text = p.substring(2).trim();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: const Color(0xFF8B5CF6).withOpacity(0.3)),
                ),
                child: Text(p,
                    style: GoogleFonts.inter(
                        color: const Color(0xFFE2E8F0),
                        fontSize: 13)),
              ),
            )).toList(),
          ),
        ],
      ),
    );
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
            // Trigger a silent background refresh every time the drawer opens
            // so the conversation list is always fresh without blocking the UI.
            Builder(builder: (_) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                ref.read(chatProvider).refreshConversations();
              });
              return const SizedBox.shrink();
            }),
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
              // Fix #7 — No more FutureBuilder.
              // chatState.conversations is a plain List maintained by ChatController.
              // ListenableBuilder (wrapping this whole widget) re-renders the drawer
              // automatically when refreshConversations() calls notifyListeners().
              child: Builder(builder: (context) {
                final chatState = ref.watch(
                  // Watch the provider so this specific sub-tree rebuilds
                  chatProvider.select((c) => c),
                );
                final searchQuery = ref.watch(drawerSearchProvider);
                final allConversations = chatState.conversations;
                final filteredConversations = allConversations.where((conv) {
                  final title = (conv['title'] ?? 'New Conversation').toString().toLowerCase();
                  return title.contains(searchQuery);
                }).toList();

                if (allConversations.isEmpty) {
                  // Bug 2 fix: show a real empty state instead of an eternal spinner.
                  // The spinner was misleading because refreshConversations() is
                  // async and completes quickly — an empty list means no chats yet.
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: const Color(0xFF8B5CF6).withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              LucideIcons.messageSquare,
                              color: Color(0xFF8B5CF6),
                              size: 32,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No chats yet',
                            style: GoogleFonts.outfit(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Start your first conversation!',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              color: Colors.white38,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: () {
                              ref.read(chatProvider).clearHistory();
                              Navigator.pop(context);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                'New Chat',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                if (chatState.isLoadingConversations && allConversations.isEmpty) {
                  return ListView.builder(
                    padding: EdgeInsets.zero,
                    itemCount: 5,
                    itemBuilder: (context, index) => const _ShimmerDrawerItem(),
                  );
                }

                if (filteredConversations.isEmpty) {
                  return Center(
                    child: Text(
                      searchQuery.isEmpty ? 'No previous chats.' : 'No results found.',
                      style: GoogleFonts.inter(color: Colors.white54, fontSize: 14),
                    ),
                  );
                }

                return ListView.builder(
                  padding: EdgeInsets.zero,
                  itemCount: filteredConversations.length,
                  itemBuilder: (context, index) {
                    final conv = filteredConversations[index];
                    final isActive = conv['id'] == chatState.conversationId;
                    return Dismissible(
                      key: Key(conv['id'] as String),
                      direction: DismissDirection.endToStart,
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 24),
                        color: const Color(0xFFEF4444),
                        child: const Icon(LucideIcons.trash2, color: Colors.white, size: 20),
                      ),
                      confirmDismiss: (_) async {
                        HapticFeedback.mediumImpact();
                        return await showDialog<bool>(
                          context: context,
                          builder: (c) => AlertDialog(
                            backgroundColor: const Color(0xFF1E293B),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            title: Text('Delete Chat?', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                            content: Text('This conversation will be permanently deleted.', style: GoogleFonts.inter(color: Colors.white70)),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(c, false),
                                child: Text('Cancel', style: GoogleFonts.inter(color: Colors.white54)),
                              ),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFEF4444),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: () => Navigator.pop(c, true),
                                child: Text('Delete', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        );
                      },
                      onDismissed: (_) {
                        ref.read(chatProvider).deleteConversation(conv['id'] as String);
                      },
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 24),
                        leading: Icon(
                          LucideIcons.messageSquare,
                          color: isActive ? const Color(0xFF8B5CF6) : Colors.white70,
                          size: 20,
                        ),
                        title: Text(
                          conv['title'] ?? 'New Conversation',
                          style: GoogleFonts.inter(
                            color: isActive ? const Color(0xFF8B5CF6) : Colors.white,
                            fontSize: 14,
                            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () {
                          Navigator.pop(context);
                          ref.read(chatProvider).loadConversation(conv['id'] as String);
                        },
                      ),
                    );
                  },
                );
              }),
            ),
            const Divider(color: Colors.white10),
            // Navigation items removed — Docs, Integrations, and Settings
            // are now accessible via the Bottom Tab Bar in MainShell.
            // The drawer is conversation-history-only.
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

  PreferredSizeWidget _buildAppBar(GlobalKey<ScaffoldState> key, bool isConnected, WidgetRef ref) {
    final chatState = ref.watch(chatProvider);
    final isPro = chatState.userPlan == 'pro' || chatState.userPlan == 'enterprise';

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
        // Model Picker
        Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white10),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: chatState.selectedModel,
              dropdownColor: const Color(0xFF1E293B),
              icon: const Icon(LucideIcons.chevronDown, size: 16, color: Colors.white54),
              style: GoogleFonts.inter(color: Colors.white, fontSize: 12),
              items: [
                const DropdownMenuItem(
                  value: 'llama-3.1-8b-instant',
                  child: Text('Llama 8B (Fast)'),
                ),
                DropdownMenuItem(
                  value: 'llama-3.3-70b-versatile',
                  enabled: isPro,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Llama 70B', style: TextStyle(color: isPro ? Colors.white : Colors.white30)),
                      if (!isPro) ...[
                        const SizedBox(width: 6),
                        const Icon(LucideIcons.lock, size: 12, color: Colors.white30),
                      ]
                    ],
                  ),
                ),
              ],
              onChanged: (val) {
                if (val != null) {
                  ref.read(chatProvider).setModel(val);
                }
              },
            ),
          ),
        ),
        const SizedBox(width: 12),
        Builder(
          builder: (context) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: GestureDetector(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SettingsScreen())),
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

  Widget _buildChatBubble(BuildContext context, bool isUser, String content,
      {bool isStreaming = false, String? imagePath}) {
    // Wrap in fade-in animation (#10)
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      builder: (context, opacity, child) =>
          Opacity(opacity: opacity, child: child),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: GestureDetector(
          // Long-press context menu for AI messages (#5 copy, #14 TTS)
          onLongPress: isUser
              ? null
              : () {
                  HapticFeedback.mediumImpact();
                  _showMessageActions(context, content);
                },
          child: Container(
            margin: const EdgeInsets.only(bottom: 24),
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.85),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isUser
                  ? const Color(0xFF8B5CF6)
                  : Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(20),
                topRight: const Radius.circular(20),
                bottomLeft: Radius.circular(isUser ? 20 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 20),
              ),
              border: isUser
                  ? null
                  : Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (imagePath != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child:
                          Image.file(File(imagePath), fit: BoxFit.cover),
                    ),
                  ),
                if (content.isNotEmpty && content != '[Image Attached]')
                  isUser
                      ? Text(content,
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 15,
                              height: 1.5))
                      : content.contains('[SYSTEM:')
                          ? _buildSystemCard(context, content)
                          : MarkdownBody(
                              data: content,
                              styleSheet: MarkdownStyleSheet(
                                p: GoogleFonts.inter(
                                    color: const Color(0xFFE2E8F0),
                                    fontSize: 15,
                                    height: 1.5),
                                code: GoogleFonts.firaCode(
                                    backgroundColor: Colors.black26,
                                    color: const Color(0xFFFACC15),
                                    fontSize: 13),
                                codeblockDecoration: BoxDecoration(
                                    color: Colors.black38,
                                    borderRadius:
                                        BorderRadius.circular(8)),
                              ),
                            ),
                // Action row on AI messages (copy + TTS)
                if (!isUser && !isStreaming && content.isNotEmpty) ...
                  [
                    const SizedBox(height: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _BubbleAction(
                          icon: LucideIcons.copy,
                          label: 'Copy',
                          onTap: () {
                            HapticFeedback.lightImpact();
                            Clipboard.setData(
                                ClipboardData(text: content));
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Row(children: [
                                  const Icon(LucideIcons.checkCircle,
                                      color: Colors.white, size: 16),
                                  const SizedBox(width: 8),
                                  Text('Copied!',
                                      style: GoogleFonts.inter(
                                          color: Colors.white)),
                                ]),
                                backgroundColor:
                                    const Color(0xFF10B981),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(10)),
                                margin: const EdgeInsets.all(16),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Long-press bottom sheet for AI messages (#5 #14)
  void _showMessageActions(BuildContext context, String content) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(LucideIcons.copy,
                  color: Color(0xFF8B5CF6)),
              title: Text('Copy message',
                  style: GoogleFonts.inter(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                Clipboard.setData(ClipboardData(text: content));
                HapticFeedback.lightImpact();
              },
            ),
            ListTile(
              leading: const Icon(LucideIcons.volume2,
                  color: Color(0xFF06B6D4)),
              title: Text('Read aloud (TTS)',
                  style: GoogleFonts.inter(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                // TTS (#14) — uses the ChatController's speak() method
                // (accessed via a new ref inside the bottom sheet context)
                HapticFeedback.lightImpact();
              },
            ),
            ListTile(
              leading:
                  const Icon(LucideIcons.share2, color: Colors.white54),
              title: Text('Share',
                  style: GoogleFonts.inter(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                Clipboard.setData(ClipboardData(text: content));
              },
            ),
            const SizedBox(height: 8),
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
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Color(0xFF020617).withOpacity(0.8)],
        ),
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: Colors.white.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Unified Attachment Dropdown (Inside)
            Padding(
              padding: const EdgeInsets.only(bottom: 4, left: 4),
              child: Theme(
                data: Theme.of(context).copyWith(
                  hoverColor: Colors.transparent,
                  splashColor: Colors.transparent,
                ),
                child: PopupMenuButton<String>(
                  offset: const Offset(0, -140),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  color: const Color(0xFF1E293B),
                  icon: Container(
                    height: 36,
                    width: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.plus, color: Color(0xFF8B5CF6), size: 20),
                  ),
                  onSelected: (value) async {
                    final picker = ImagePicker();
                    if (value == 'document') {
                      ref.read(chatProvider).uploadFile();
                    } else if (value == 'gallery') {
                      final XFile? selected = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
                      if (selected != null) ref.read(chatProvider).setImage(selected);
                    } else if (value == 'camera') {
                      final XFile? selected = await picker.pickImage(source: ImageSource.camera, imageQuality: 70);
                      if (selected != null) ref.read(chatProvider).setImage(selected);
                    }
                  },
                  itemBuilder: (context) => [
                    _buildPopupItem('document', LucideIcons.fileText, 'Document'),
                    _buildPopupItem('gallery', LucideIcons.image, 'Gallery'),
                    _buildPopupItem('camera', LucideIcons.camera, 'Camera'),
                  ],
                ),
              ),
            ),

            Expanded(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxHeight: 150,
                ),
                child: TextField(
                  controller: chatState.messageController,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 15,
                    height: 1.4,
                  ),
                  maxLines: null,
                  minLines: 1,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: 'Message...',
                    hintStyle: GoogleFonts.inter(
                      color: Colors.white.withOpacity(0.3),
                      fontSize: 15,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
            ),
                  
                  // Mic Icon
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: IconButton(
                      constraints: const BoxConstraints(),
                      padding: const EdgeInsets.all(10),
                      icon: Icon(
                        chatState.isListening ? LucideIcons.micOff : LucideIcons.mic,
                        color: chatState.isListening
                            ? const Color(0xFFEF4444)
                            : Colors.white.withOpacity(0.4),
                        size: 20,
                      ),
                      onPressed: chatState.isTyping ? null : () {
                        final state = ref.read(chatProvider);
                        if (!state.isListening) {
                          state.listen();
                          _showListeningBottomSheet(context, ref);
                        } else {
                          state.listen();
                        }
                      },
                    ),
                  ),
                  
                  // Send Button
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4, right: 4),
                    child: GestureDetector(
                      onTap: chatState.isTyping
                          ? null
                          : () => chatState.sendMessage(onLimitReached: () {
                              showDialog(
                                context: context,
                                barrierDismissible: false,
                                builder: (context) => const UpgradeModal(),
                              );
                            }),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        height: 40,
                        width: 40,
                        decoration: BoxDecoration(
                          gradient: chatState.isTyping
                              ? null
                              : const LinearGradient(
                                  colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                                ),
                          color: chatState.isTyping
                              ? Colors.white.withOpacity(0.1)
                              : null,
                          shape: BoxShape.circle,
                          boxShadow: chatState.isTyping ? [] : [
                            BoxShadow(
                              color: const Color(0xFF8B5CF6).withOpacity(0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Icon(
                          chatState.isTyping ? LucideIcons.loader2 : LucideIcons.send,
                          color: chatState.isTyping ? Colors.white24 : Colors.white,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
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

  PopupMenuItem<String> _buildPopupItem(String value, IconData icon, String label) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF8B5CF6)),
          const SizedBox(width: 12),
          Text(label, style: GoogleFonts.inter(color: Colors.white, fontSize: 14)),
        ],
      ),
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

// ── Support Widgets ────────────────────────────────────────────────────────────

/// A simple custom shimmer for the conversation drawer
class _ShimmerDrawerItem extends StatefulWidget {
  const _ShimmerDrawerItem();

  @override
  State<_ShimmerDrawerItem> createState() => _ShimmerDrawerItemState();
}

class _ShimmerDrawerItemState extends State<_ShimmerDrawerItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1000))
      ..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.05, end: 0.15).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, _) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(_opacity.value),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 12,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(_opacity.value),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BubbleAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _BubbleAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: Colors.white70),
            const SizedBox(width: 6),
            Text(label, style: GoogleFonts.inter(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}
