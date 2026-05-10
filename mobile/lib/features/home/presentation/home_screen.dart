import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/features/chat/providers/chat_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shell/main_shell.dart';

/// HomeScreen — Dashboard tab showing plan usage, stats, and quick actions.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _docCount = 0;
  int _convCount = 0;
  bool _statsLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final docs = await Supabase.instance.client
          .from('documents')
          .select('id')
          .eq('user_id', user.id);
      final convs = await Supabase.instance.client
          .from('conversations')
          .select('id')
          .eq('user_id', user.id);
      if (mounted) {
        setState(() {
          _docCount   = (docs as List).length;
          _convCount  = (convs as List).length;
          _statsLoaded = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _statsLoaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final user      = Supabase.instance.client.auth.currentUser;
    final name      = (user?.userMetadata?['full_name'] as String?)?.split(' ').first ?? 'there';
    final plan      = chatState.userPlan;
    final used      = chatState.messageCount;
    final limit     = chatState.messageLimit;
    final isPro     = plan == 'pro' || plan == 'enterprise';

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: CustomScrollView(
        slivers: [
          // ── Header ─────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 24,
                left: 24,
                right: 24,
                bottom: 24,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    const Color(0xFF8B5CF6).withOpacity(0.15),
                    const Color(0xFF6366F1).withOpacity(0.05),
                  ],
                ),
                border: Border(
                  bottom: BorderSide(color: Colors.white.withOpacity(0.06)),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // Avatar
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: const Color(0xFF8B5CF6).withOpacity(0.2),
                        backgroundImage: user?.userMetadata?['avatar_url'] != null
                            ? NetworkImage(user!.userMetadata!['avatar_url'])
                            : null,
                        child: user?.userMetadata?['avatar_url'] == null
                            ? Text(
                                name.substring(0, 1).toUpperCase(),
                                style: GoogleFonts.outfit(
                                    color: const Color(0xFF8B5CF6),
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold),
                              )
                            : null,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Good ${_greeting()}, $name',
                              style: GoogleFonts.outfit(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?.email ?? '',
                              style: GoogleFonts.inter(
                                  color: Colors.white38, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      if (isPro)
                        // Plan badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [
                                    Color(0xFFF59E0B),
                                    Color(0xFFEF4444)
                                  ]),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '⚡ PRO',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(20),
            sliver: SliverList(
              delegate: SliverChildListDelegate([

                // ── Usage card ──────────────────────────────────────────
                _UsageCard(used: used, limit: limit, isPro: isPro),

                const SizedBox(height: 20),

                // ── Stats row ───────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        icon: LucideIcons.messageSquare,
                        label: 'Conversations',
                        value: _statsLoaded ? '$_convCount' : '—',
                        color: const Color(0xFF6366F1),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                        icon: LucideIcons.fileText,
                        label: 'Documents',
                        value: _statsLoaded ? '$_docCount' : '—',
                        color: const Color(0xFF06B6D4),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                        icon: LucideIcons.workflow,
                        label: 'Plan',
                        value: plan.toUpperCase(),
                        color: isPro
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFF10B981),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // ── Quick actions ────────────────────────────────────────
                Text(
                  'QUICK ACTIONS',
                  style: GoogleFonts.inter(
                      color: Colors.white38,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2),
                ),
                const SizedBox(height: 12),
                ..._quickActions.map((a) => _QuickActionTile(action: a)),

                if (!isPro) ...[
                  const SizedBox(height: 24),
                  // ── Upgrade CTA ────────────────────────────────────────
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      ref.read(chatProvider).startStripeUpgrade();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF8B5CF6).withOpacity(0.25),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Row(
                      children: [
                        const Icon(LucideIcons.zap,
                            color: Colors.white, size: 28),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Upgrade to Pro',
                                  style: GoogleFonts.outfit(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text(
                                'Unlimited messages · Llama 70B · Priority support',
                                style: GoogleFonts.inter(
                                    color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'Upgrade',
                            style: GoogleFonts.inter(
                                color: const Color(0xFF8B5CF6),
                                fontWeight: FontWeight.w800,
                                fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                ],

                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}

// ── Quick actions data ─────────────────────────────────────────────────────────

final _quickActions = [
  _QA(icon: LucideIcons.messageSquare, label: 'New Chat',
      subtitle: 'Start a fresh conversation with LuminaAI',
      color: const Color(0xFF8B5CF6),
      onTap: (ref) {
        ref.read(chatProvider).clearHistory();
        ref.read(shellIndexProvider.notifier).setIndex(1);
      }),
  _QA(icon: LucideIcons.upload, label: 'Upload Document',
      subtitle: 'Add a PDF or text file to your knowledge base',
      color: const Color(0xFF06B6D4),
      onTap: (ref) {
        ref.read(shellIndexProvider.notifier).setIndex(2);
      }),
  _QA(icon: LucideIcons.workflow, label: 'Manage Integrations',
      subtitle: 'Connect GitHub, Discord, Slack and more',
      color: const Color(0xFF10B981),
      onTap: (ref) {
        ref.read(shellIndexProvider.notifier).setIndex(3);
      }),
];

class _QA {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final void Function(WidgetRef ref) onTap;
  const _QA({required this.icon, required this.label,
              required this.subtitle, required this.color, required this.onTap});
}

// ── Widgets ────────────────────────────────────────────────────────────────────

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.used, required this.limit, required this.isPro});
  final int used;
  final int? limit;
  final bool isPro;

  @override
  Widget build(BuildContext context) {
    final pct = limit != null ? (used / limit!).clamp(0.0, 1.0) : 0.0;
    final isNearLimit = pct > 0.8 && !isPro;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isNearLimit
              ? const Color(0xFFEF4444).withOpacity(0.4)
              : Colors.white.withOpacity(0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.barChart2,
                  color: isNearLimit
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF8B5CF6),
                  size: 20),
              const SizedBox(width: 10),
              Text('Message Usage',
                  style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold)),
              const Spacer(),
              Text(
                isPro ? '∞ Unlimited' : '$used / ${limit ?? '∞'}',
                style: GoogleFonts.inter(
                  color: isNearLimit
                      ? const Color(0xFFEF4444)
                      : Colors.white54,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (!isPro) ...[
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 6,
                backgroundColor: Colors.white.withOpacity(0.06),
                valueColor: AlwaysStoppedAnimation<Color>(
                  isNearLimit
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF8B5CF6),
                ),
              ),
            ),
            if (isNearLimit) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(LucideIcons.alertTriangle,
                      color: Color(0xFFEF4444), size: 14),
                  const SizedBox(width: 6),
                  Text(
                    'You\'re running low! Upgrade to continue.',
                    style: GoogleFonts.inter(
                        color: const Color(0xFFEF4444), fontSize: 12),
                  ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.icon, required this.label,
                   required this.value, required this.color});
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(value,
              style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  color: Colors.white38, fontSize: 10)),
        ],
      ),
    );
  }
}

class _QuickActionTile extends ConsumerWidget {
  const _QuickActionTile({required this.action});
  final _QA action;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        action.onTap(ref);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.07)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: action.color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(action.icon, color: action.color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(action.label,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(action.subtitle,
                      style: GoogleFonts.inter(
                          color: Colors.white38, fontSize: 12)),
                ],
              ),
            ),
            Icon(LucideIcons.chevronRight,
                color: Colors.white24, size: 16),
          ],
        ),
      ),
    );
  }
}
