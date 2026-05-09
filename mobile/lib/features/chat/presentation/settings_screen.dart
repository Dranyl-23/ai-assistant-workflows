import 'dart:io';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _nameController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = Supabase.instance.client.auth.currentUser;
    if (user != null && user.userMetadata != null) {
      _nameController.text = user.userMetadata!['full_name'] ?? '';
    }
  }

  Future<void> _updateProfile() async {
    setState(() => _isLoading = true);
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(data: {'full_name': _nameController.text.trim()}),
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error updating: $e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _selectedLanguage = 'en-US';
  double _speechSpeed = 1.0;

  void _showLanguagePicker() {
    final languages = {'en-US': 'English (US)', 'fil-PH': 'Tagalog/Filipino', 'ceb-PH': 'Cebuano'};
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: languages.entries.map((e) => ListTile(
          title: Text(e.value, style: const TextStyle(color: Colors.white)),
          trailing: _selectedLanguage == e.key ? const Icon(Icons.check, color: Color(0xFF8B5CF6)) : null,
          onTap: () {
            setState(() => _selectedLanguage = e.key);
            Navigator.pop(context);
          },
        )).toList(),
      ),
    );
  }

  void _showSpeedPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Speech Speed', style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            StatefulBuilder(builder: (context, setModalState) => Slider(
              value: _speechSpeed,
              min: 0.5,
              max: 2.0,
              divisions: 6,
              activeColor: const Color(0xFF8B5CF6),
              label: '${_speechSpeed}x',
              onChanged: (val) {
                setModalState(() => _speechSpeed = val);
                setState(() => _speechSpeed = val);
              },
            )),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 50);
    
    if (image != null) {
      setState(() => _isLoading = true);
      try {
        final user = Supabase.instance.client.auth.currentUser;
        final fileExt = image.path.split('.').last;
        final fileName = '${user!.id}/avatar.${fileExt}';

        // 1. Upload to Supabase Storage
        await Supabase.instance.client.storage
            .from('avatars')
            .upload(fileName, File(image.path), fileOptions: const FileOptions(upsert: true));

        // 2. Get Public URL
        final String publicUrl = Supabase.instance.client.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // 3. Update User Metadata
        await Supabase.instance.client.auth.updateUser(
          UserAttributes(data: {'avatar_url': publicUrl}),
        );

        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Avatar updated successfully!')));
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final String? avatarUrl = user?.userMetadata?['avatar_url'];
    
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Settings', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: GestureDetector(
                onTap: _pickAvatar,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundColor: const Color(0xFF8B5CF6).withOpacity(0.2),
                      backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl) : null,
                      child: avatarUrl == null ? Text(
                        user?.userMetadata?['full_name']?.substring(0, 1).toUpperCase() ?? 'U',
                        style: GoogleFonts.outfit(fontSize: 40, color: const Color(0xFF8B5CF6), fontWeight: FontWeight.bold),
                      ) : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(color: Color(0xFF8B5CF6), shape: BoxShape.circle),
                        child: const Icon(LucideIcons.camera, color: Colors.white, size: 16),
                      ),
                    )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            Text('Account Information', style: GoogleFonts.inter(color: Colors.white54, fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Full Name',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: TextEditingController(text: user?.email ?? ''),
              readOnly: true,
              style: const TextStyle(color: Colors.white54),
              decoration: InputDecoration(
                labelText: 'Email Address',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: Colors.white.withOpacity(0.05),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isLoading ? null : _updateProfile,
                child: _isLoading 
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Save Changes', style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 40),
            Text('Voice & Audio', style: GoogleFonts.inter(color: Colors.white54, fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Text-to-Speech Language', style: GoogleFonts.inter(color: Colors.white)),
              subtitle: Text(_selectedLanguage == 'en-US' ? 'English (US)' : (_selectedLanguage == 'fil-PH' ? 'Tagalog' : 'Cebuano'), style: GoogleFonts.inter(color: Colors.white54)),
              trailing: const Icon(LucideIcons.chevronRight, color: Colors.white54),
              onTap: _showLanguagePicker,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('Speech Speed', style: GoogleFonts.inter(color: Colors.white)),
              subtitle: Text('${_speechSpeed.toStringAsFixed(1)}x', style: GoogleFonts.inter(color: Colors.white54)),
              trailing: const Icon(LucideIcons.chevronRight, color: Colors.white54),
              onTap: _showSpeedPicker,
            ),
          ],
        ),
      ),
    );
  }
}
