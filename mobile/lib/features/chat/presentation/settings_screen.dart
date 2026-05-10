import 'dart:io';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/chat/providers/chat_provider.dart';
import 'package:mobile/features/subscription/presentation/upgrade_modal.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';

// ── Hive persistence keys ─────────────────────────────────────────────────────
const _kSettingsBox     = 'settings';
const _kLanguageKey     = 'tts_language';
const _kSpeedKey        = 'tts_speed';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final TextEditingController _nameController = TextEditingController();
  bool _isLoading = false;

  // Bug 4 fix: voice settings are now loaded from Hive on init and saved
  // on every change, so they survive screen rebuilds and app restarts.
  String _selectedLanguage = 'en-US';
  double _speechSpeed      = 1.0;

  late Box _settingsBox;

  @override
  void initState() {
    super.initState();

    // Restore name from Supabase user metadata
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null && user.userMetadata != null) {
      _nameController.text = user.userMetadata!['full_name'] ?? '';
    }

    // Restore voice settings from Hive
    _settingsBox = Hive.box(_kSettingsBox);
    _selectedLanguage = (_settingsBox.get(_kLanguageKey) as String?) ?? 'en-US';
    _speechSpeed      = (_settingsBox.get(_kSpeedKey)    as double?) ?? 1.0;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  Future<void> _updateProfile() async {
    setState(() => _isLoading = true);
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(data: {'full_name': _nameController.text.trim()}),
      );
      if (mounted) {
        _showSnack('Profile updated!', isError: false);
      }
    } catch (e) {
      if (mounted) _showSnack('Error updating profile: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final XFile? image =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 50);

    if (image == null) return;
    setState(() => _isLoading = true);
    try {
      final user  = Supabase.instance.client.auth.currentUser!;
      final ext   = image.path.split('.').last;
      final path  = '${user.id}/avatar.$ext';

      await Supabase.instance.client.storage
          .from('avatars')
          .upload(path, File(image.path),
              fileOptions: const FileOptions(upsert: true));

      final url = Supabase.instance.client.storage
          .from('avatars')
          .getPublicUrl(path);

      await Supabase.instance.client.auth.updateUser(
        UserAttributes(data: {'avatar_url': url}),
      );

      if (mounted) _showSnack('Avatar updated!', isError: false);
    } catch (e) {
      if (mounted) _showSnack('Upload failed: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Voice pickers ─────────────────────────────────────────────────────────

  void _showLanguagePicker() {
    final languages = {
      'en-US':  'English (US)',
      'fil-PH': 'Tagalog / Filipino',
      'ceb-PH': 'Cebuano',
    };

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Select Language',
              style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ...languages.entries.map((e) => ListTile(
                  title: Text(e.value,
                      style: GoogleFonts.inter(color: Colors.white)),
                  trailing: _selectedLanguage == e.key
                      ? const Icon(LucideIcons.checkCircle,
                          color: Color(0xFF8B5CF6))
                      : null,
                  onTap: () {
                    setState(() => _selectedLanguage = e.key);
                    // Persist to Hive immediately
                    _settingsBox.put(_kLanguageKey, e.key);
                    Navigator.pop(context);
                  },
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showSpeedPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Speech Speed',
                style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                '${_speechSpeed.toStringAsFixed(1)}×',
                style: GoogleFonts.inter(
                    color: const Color(0xFF8B5CF6),
                    fontSize: 28,
                    fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              StatefulBuilder(
                builder: (context, setModalState) => Slider(
                  value: _speechSpeed,
                  min: 0.5,
                  max: 2.0,
                  divisions: 6,
                  activeColor: const Color(0xFF8B5CF6),
                  inactiveColor: Colors.white12,
                  label: '${_speechSpeed.toStringAsFixed(1)}×',
                  onChanged: (val) {
                    setModalState(() => _speechSpeed = val);
                    setState(() => _speechSpeed = val);
                    // Persist to Hive on every slider change
                    _settingsBox.put(_kSpeedKey, val);
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('0.5× (Slow)',
                      style: GoogleFonts.inter(
                          color: Colors.white38, fontSize: 12)),
                  Text('2.0× (Fast)',
                      style: GoogleFonts.inter(
                          color: Colors.white38, fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  void _showSnack(String msg, {required bool isError}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(children: [
          Icon(
            isError ? LucideIcons.alertCircle : LucideIcons.checkCircle,
            color: Colors.white,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(msg, style: GoogleFonts.inter(color: Colors.white))),
        ]),
        backgroundColor:
            isError ? const Color(0xFFEF4444) : const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final user      = Supabase.instance.client.auth.currentUser;
    final avatarUrl = user?.userMetadata?['avatar_url'] as String?;
    final plan      = chatState.userPlan;
    final isPro     = plan == 'pro' || plan == 'enterprise';

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Settings',
            style: GoogleFonts.outfit(
                color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Avatar ──────────────────────────────────────────────────
            Center(
              child: GestureDetector(
                onTap: _pickAvatar,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundColor:
                          const Color(0xFF8B5CF6).withOpacity(0.2),
                      backgroundImage:
                          avatarUrl != null ? NetworkImage(avatarUrl) : null,
                      child: avatarUrl == null
                          ? Text(
                              (user?.userMetadata?['full_name'] as String? ?? 'U')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: GoogleFonts.outfit(
                                fontSize: 40,
                                color: const Color(0xFF8B5CF6),
                                fontWeight: FontWeight.bold,
                              ),
                            )
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                            color: Color(0xFF8B5CF6),
                            shape: BoxShape.circle),
                        child: const Icon(LucideIcons.camera,
                            color: Colors.white, size: 16),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 8),
            Center(
              child: Text(
                user?.email ?? '',
                style: GoogleFonts.inter(
                    color: Colors.white38, fontSize: 13),
              ),
            ),

            const SizedBox(height: 32),

            // ── Account ─────────────────────────────────────────────────
            _sectionHeader('Account Information'),
            const SizedBox(height: 16),
            _buildTextField(
              controller: _nameController,
              label: 'Full Name',
              icon: LucideIcons.user,
            ),
            const SizedBox(height: 16),
            _buildTextField(
              controller: TextEditingController(text: user?.email ?? ''),
              label: 'Email Address',
              icon: LucideIcons.mail,
              readOnly: true,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                onPressed: _isLoading ? null : _updateProfile,
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : Text('Save Changes',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold)),
              ),
            ),

            const SizedBox(height: 40),

            // ── Billing & Plan (#12) ────────────────────────────────────
            _sectionHeader('Billing & Plan'),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isPro
                      ? const Color(0xFFF59E0B).withOpacity(0.5)
                      : Colors.white.withOpacity(0.08),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isPro ? const Color(0xFFF59E0B).withOpacity(0.2) : Colors.white12,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          plan.toUpperCase(),
                          style: GoogleFonts.inter(
                            color: isPro ? const Color(0xFFF59E0B) : Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      const Spacer(),
                      if (!isPro)
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF8B5CF6),
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () {
                            showDialog(
                              context: context,
                              barrierDismissible: false,
                              builder: (context) => const UpgradeModal(),
                            );
                          },
                          child: Text('Upgrade', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                        )
                      else
                        Text('Active', style: GoogleFonts.inter(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    isPro 
                        ? 'You have unlimited access to all features and models.'
                        : 'You are on the free tier. Upgrade to unlock unlimited messages, Llama 70B, and priority support.',
                    style: GoogleFonts.inter(color: Colors.white54, fontSize: 13, height: 1.5),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 40),

            // ── Voice & Audio ────────────────────────────────────────────
            _sectionHeader('Voice & Audio'),
            const SizedBox(height: 8),
            Text(
              'Settings are saved automatically and persist across restarts.',
              style: GoogleFonts.inter(color: Colors.white38, fontSize: 12),
            ),
            const SizedBox(height: 16),

            _buildSettingsTile(
              icon: LucideIcons.globe,
              title: 'Text-to-Speech Language',
              subtitle: _languageLabel(_selectedLanguage),
              onTap: _showLanguagePicker,
            ),
            const SizedBox(height: 12),
            _buildSettingsTile(
              icon: LucideIcons.activity,
              title: 'Speech Speed',
              subtitle: '${_speechSpeed.toStringAsFixed(1)}×',
              onTap: _showSpeedPicker,
            ),
            
            const SizedBox(height: 40),

            // ── Danger Zone ──────────────────────────────────────────────
            _sectionHeader('Danger Zone'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent.withOpacity(0.1),
                  foregroundColor: Colors.redAccent,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: Colors.redAccent, width: 1.5),
                  ),
                ),
                icon: const Icon(LucideIcons.logOut, size: 18),
                label: Text('Sign Out', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
                onPressed: () => _showSignOutDialog(context),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // ── Sub-widgets ────────────────────────────────────────────────────────────

  Widget _sectionHeader(String title) => Text(
        title,
        style: GoogleFonts.inter(
            color: Colors.white54,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5),
      );

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool readOnly = false,
  }) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      style: TextStyle(
          color: readOnly ? Colors.white38 : Colors.white, fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white54, fontSize: 13),
        prefixIcon: Icon(icon, color: Colors.white38, size: 18),
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(
              color: Color(0xFF8B5CF6), width: 1.5),
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: const Color(0xFF8B5CF6), size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                          fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: GoogleFonts.inter(
                          color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                color: Colors.white38, size: 18),
          ],
        ),
      ),
    );
  }

  String _languageLabel(String code) {
    switch (code) {
      case 'fil-PH': return 'Tagalog / Filipino';
      case 'ceb-PH': return 'Cebuano';
      default:       return 'English (US)';
    }
  }

  void _showSignOutDialog(BuildContext context) {
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
  }
}
