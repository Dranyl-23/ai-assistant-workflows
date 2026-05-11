import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/features/chat/providers/chat_provider.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<Map<String, dynamic>> _documents = [];
  bool _isLoading  = true;
  bool _isUploading = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _fetchDocuments();
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  Future<void> _fetchDocuments() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    try {
      final response = await Supabase.instance.client
          .from('documents')
          .select()
          .eq('user_id', user.id)
          .order('created_at', ascending: false);

      setState(() {
        _documents = List<Map<String, dynamic>>.from(response as List);
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) _showSnack('Failed to load documents: $e', isError: true);
      setState(() => _isLoading = false);
    }
  }

  Future<void> _uploadDocument() async {
    HapticFeedback.lightImpact();

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'txt', 'md'],
      );

      if (result == null || result.files.single.path == null) return;

      final fileName = result.files.single.name;
      final file     = File(result.files.single.path!);

      setState(() => _isUploading = true);

      final session = Supabase.instance.client.auth.currentSession;
      if (session == null) throw Exception('Not authenticated');

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$backendUrl/api/documents/upload'),
      );
      request.headers['Authorization'] = 'Bearer ${session.accessToken}';
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final response =
          await request.send().timeout(const Duration(seconds: 60));

      if (response.statusCode == 201) {
        _showSnack(' "$fileName" uploaded successfully!', isError: false);
        await _fetchDocuments(); // Refresh the list
      } else {
        _showSnack('Upload failed (status ${response.statusCode})', isError: true);
      }
    } catch (e) {
      if (mounted) _showSnack('Upload error: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _deleteDocument(String id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Delete Document?',
          style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: Text(
          '"$name" will be permanently removed and the AI will no longer have access to its knowledge.',
          style: GoogleFonts.inter(color: Colors.white70, fontSize: 14),
        ),
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
            child: Text('Delete',
                style: GoogleFonts.inter(
                    color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await Supabase.instance.client
          .from('documents')
          .delete()
          .eq('id', id);
      _showSnack('Document deleted', isError: false);
      await _fetchDocuments();
    } catch (e) {
      if (mounted) _showSnack('Failed to delete: $e', isError: true);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _formatSize(int bytes) {
    if (bytes < 1024)            return '$bytes B';
    if (bytes < 1024 * 1024)    return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData _iconForType(String? type) {
    switch (type?.toLowerCase()) {
      case 'pdf':  return LucideIcons.fileText;
      case 'md':   return LucideIcons.fileCode;
      default:     return LucideIcons.file;
    }
  }

  void _showSnack(String msg, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(children: [
          Icon(
            isError ? LucideIcons.alertCircle : LucideIcons.checkCircle,
            color: Colors.white,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 14))),
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

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Document Library',
          style: GoogleFonts.outfit(
              color: Colors.white, fontWeight: FontWeight.bold),
        ),
        actions: [
          // Document count badge
          if (!_isLoading && _documents.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: const Color(0xFF8B5CF6).withOpacity(0.3)),
                  ),
                  child: Text(
                    '${_documents.length} doc${_documents.length == 1 ? '' : 's'}',
                    style: GoogleFonts.inter(
                        color: const Color(0xFF8B5CF6),
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
        ],
      ),

      // ── Upload info banner ─────────────────────────────────────────────────
      body: Column(
        children: [
          // Info banner (always visible)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF38BDF8).withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: const Color(0xFF38BDF8).withOpacity(0.15)),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.info,
                    color: Color(0xFF38BDF8), size: 18),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Upload PDFs, TXT or Markdown files. The AI will read them and answer your questions.',
                    style: GoogleFonts.inter(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        height: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // ── Document list ────────────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchDocuments,
              color: const Color(0xFF8B5CF6),
              backgroundColor: const Color(0xFF1E293B),
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: Color(0xFF8B5CF6)))
                  : _documents.isEmpty
                      ? _buildEmptyState()
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          itemCount: _documents.length,
                          itemBuilder: (context, index) =>
                              _buildDocumentCard(_documents[index]),
                        ),
            ),
          ),
        ],
      ),

      // ── Upload FAB ─────────────────────────────────────────────────────────
      floatingActionButton: (_documents.isEmpty && !_isLoading && !_isUploading)
          ? null
          : _isUploading
              ? FloatingActionButton.extended(
                  onPressed: null,
                  backgroundColor: const Color(0xFF8B5CF6),
                  icon: const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  ),
                  label: Text('Uploading...',
                      style: GoogleFonts.inter(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                )
              : FloatingActionButton.extended(
                  onPressed: _uploadDocument,
                  backgroundColor: const Color(0xFF8B5CF6),
                  elevation: 4,
                  icon: const Icon(LucideIcons.upload, color: Colors.white, size: 20),
                  label: Text(
                    'Upload Document',
                    style: GoogleFonts.inter(
                        color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
    );
  }

  // ── Sub-widgets ─────────────────────────────────────────────────────────────

  Widget _buildEmptyState() {
    return Stack(
      children: [
        // Need a ListView for RefreshIndicator to work on empty state
        ListView(),
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withOpacity(0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    LucideIcons.folderOpen,
                    color: Color(0xFF8B5CF6),
                    size: 48,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'No documents yet',
                  style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Upload a PDF, TXT, or Markdown file to give the AI access to your knowledge base.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                      color: Colors.white38,
                      fontSize: 14,
                      height: 1.6),
                ),
                const SizedBox(height: 28),
                GestureDetector(
                  onTap: _uploadDocument,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)]),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF8B5CF6).withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(LucideIcons.upload,
                            color: Colors.white, size: 18),
                        const SizedBox(width: 10),
                        Text(
                          'Upload your first document',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDocumentCard(Map<String, dynamic> doc) {
    final name = doc['name'] as String? ?? 'Untitled Document';
    final type = (doc['type'] as String? ?? '').toLowerCase();
    final size = doc['size'] as int? ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF8B5CF6).withOpacity(0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            _iconForType(type),
            color: const Color(0xFF8B5CF6),
            size: 22,
          ),
        ),
        title: Text(
          name,
          style: GoogleFonts.inter(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            children: [
              Flexible(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    type.isNotEmpty ? type.toUpperCase() : 'FILE',
                    style: GoogleFonts.inter(
                        color: const Color(0xFF8B5CF6),
                        fontSize: 10,
                        fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _formatSize(size),
                style: GoogleFonts.inter(
                    color: Colors.white38, fontSize: 12),
              ),
            ],
          ),
        ),
        trailing: IconButton(
          icon: const Icon(LucideIcons.trash2,
              color: Color(0xFFEF4444), size: 20),
          onPressed: () => _deleteDocument(doc['id'] as String, name),
        ),
      ),
    );
  }
}
