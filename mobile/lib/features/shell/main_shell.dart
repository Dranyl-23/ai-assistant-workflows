import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:mobile/features/home/presentation/home_screen.dart';
import 'package:mobile/features/chat/presentation/chat_screen.dart';
import 'package:mobile/features/chat/presentation/documents_screen.dart';
import 'package:mobile/features/chat/presentation/integrations_screen.dart';
import 'package:mobile/features/chat/presentation/settings_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ShellIndexNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void setIndex(int index) => state = index;
}

final shellIndexProvider = NotifierProvider<ShellIndexNotifier, int>(() {
  return ShellIndexNotifier();
});

/// MainShell — five-tab bottom navigation host.
///
/// Uses [IndexedStack] so every tab preserves its widget state (socket stays
/// connected, scroll positions persist, Hive boxes stay open) across tab switches.
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {

  static const Color _accentViolet = Color(0xFF8B5CF6);
  static const Color _navBg        = Color(0xFF0F172A);
  static const Color _textMuted    = Color(0xFF64748B);
  static const Color _border       = Color(0x1AFFFFFF);

  static const _tabs = [
    _TabItem(icon: LucideIcons.home,         label: 'Home'),
    _TabItem(icon: LucideIcons.messageSquare, label: 'Chat'),
    _TabItem(icon: LucideIcons.fileText,      label: 'Docs'),
    _TabItem(icon: LucideIcons.workflow,      label: 'Integrations'),
    _TabItem(icon: LucideIcons.settings,      label: 'Settings'),
  ];

  final List<Widget> _screens = const [
    HomeScreen(),
    ChatScreen(),
    DocumentsScreen(),
    IntegrationsScreen(),
    SettingsScreen(),
  ];

  void _onTabTapped(int index) {
    if (index == ref.read(shellIndexProvider)) return;
    HapticFeedback.lightImpact();
    ref.read(shellIndexProvider.notifier).setIndex(index);
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = ref.watch(shellIndexProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: IndexedStack(
        index: currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: _BottomNav(
        currentIndex: currentIndex,
        tabs: _tabs,
        onTap: _onTabTapped,
        bgColor: _navBg,
        accentColor: _accentViolet,
        inactiveColor: _textMuted,
        borderColor: _border,
      ),
    );
  }
}

// ── Data model ────────────────────────────────────────────────────────────────

class _TabItem {
  final IconData icon;
  final String label;
  const _TabItem({required this.icon, required this.label});
}

// ── Custom bottom nav ─────────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.currentIndex,
    required this.tabs,
    required this.onTap,
    required this.bgColor,
    required this.accentColor,
    required this.inactiveColor,
    required this.borderColor,
  });

  final int currentIndex;
  final List<_TabItem> tabs;
  final ValueChanged<int> onTap;
  final Color bgColor, accentColor, inactiveColor, borderColor;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        border: Border(top: BorderSide(color: borderColor)),
      ),
      padding: EdgeInsets.only(top: 8, bottom: bottom > 0 ? bottom : 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(tabs.length, (i) {
          final active = i == currentIndex;
          final tab    = tabs[i];
          return Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? accentColor.withOpacity(0.15) : Colors.transparent,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(tab.icon, size: 22,
                        color: active ? accentColor : inactiveColor),
                  ),
                  const SizedBox(height: 4),
                  Text(tab.label,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      color: active ? accentColor : inactiveColor,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
