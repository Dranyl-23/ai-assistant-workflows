import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:simple_icons/simple_icons.dart';

class IntegrationsScreen extends StatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  State<IntegrationsScreen> createState() => _IntegrationsScreenState();
}

class _IntegrationsScreenState extends State<IntegrationsScreen> {
  List<Map<String, dynamic>> _activeIntegrations = [];
  bool _isLoading = true;

  // All providers — including newly added Slack and Notion (#13)
  final List<Map<String, dynamic>> _providers = [
    {
      'id': 'github',
      'name': 'GitHub',
      'description': 'Read repos, create issues & PRs via AI commands',
      'icon': SimpleIcons.github,
      'color': const Color(0xFFE2E8F0),
      'configFields': [
        {'label': 'Personal Access Token', 'key': 'accessToken'},
        {'label': 'Default Repo (user/repo)', 'key': 'defaultRepo', 'optional': true},
      ],
    },
    {
      'id': 'discord',
      'name': 'Discord',
      'description': 'Send messages and notifications to Discord channels',
      'icon': SimpleIcons.discord,
      'color': const Color(0xFF5865F2),
      'configFields': [
        {'label': 'Webhook URL', 'key': 'webhookUrl'},
        {'label': 'Bot Token (Optional)', 'key': 'botToken', 'optional': true},
      ],
    },
    {
      'id': 'slack',
      'name': 'Slack',
      'description': 'Post messages to Slack channels via AI actions',
      'icon': SimpleIcons.slack,
      'color': const Color(0xFFE01E5A), // Bright Slack pink for visibility in dark mode
      'configFields': [
        {'label': 'Webhook URL', 'key': 'webhookUrl'},
        {'label': 'Channel (e.g. #general)', 'key': 'channel', 'optional': true},
      ],
    },
    {
      'id': 'notion',
      'name': 'Notion',
      'description': 'Create pages and update databases with AI',
      'icon': SimpleIcons.notion,
      'color': const Color(0xFFFFFFFF), // White instead of black for dark mode
      'configFields': [
        {'label': 'Integration Token', 'key': 'accessToken'},
        {'label': 'Database ID', 'key': 'databaseId', 'optional': true},
      ],
    },
    {
      'id': 'n8n',
      'name': 'N8N Webhooks',
      'description': 'Trigger advanced custom automation workflows',
      'icon': SimpleIcons.n8n,
      'color': const Color(0xFFFF6D5A),
      'configFields': [
        {'label': 'Webhook URL', 'key': 'webhookUrl'},
        {'label': 'Auth Header (Optional)', 'key': 'authHeader', 'optional': true},
      ],
    },
  ];

  @override
  void initState() {
    super.initState();
    _fetchIntegrations();
  }

  Future<void> _fetchIntegrations() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      final response = await Supabase.instance.client
          .from('integrations')
          .select()
          .eq('user_id', user.id);
      setState(() {
        _activeIntegrations = List<Map<String, dynamic>>.from(response as List);
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) _showSnack('Failed to load: $e', isError: true);
      setState(() => _isLoading = false);
    }
  }

  Future<void> _connectIntegration(
      String providerId, Map<String, dynamic> config) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      await Supabase.instance.client.from('integrations').upsert({
        'user_id': user.id,
        'provider': providerId,
        'status': 'active',
        'config': config,
        'created_at': DateTime.now().toIso8601String(),
      });
      await _fetchIntegrations();
      if (mounted) _showSnack('Integration connected!', isError: false);
    } catch (e) {
      if (mounted) _showSnack('Connection failed: $e', isError: true);
    }
  }

  Future<void> _disconnectIntegration(String id) async {
    HapticFeedback.mediumImpact();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Disconnect?',
            style: GoogleFonts.outfit(
                color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(
            'This will remove the integration. The AI will no longer be able to trigger this service.',
            style: GoogleFonts.inter(color: Colors.white70)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text('Cancel',
                  style: GoogleFonts.inter(color: Colors.white54))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10))),
            onPressed: () => Navigator.pop(c, true),
            child: Text('Disconnect',
                style: GoogleFonts.inter(
                    color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await Supabase.instance.client
          .from('integrations')
          .delete()
          .eq('id', id);
      await _fetchIntegrations();
      if (mounted) _showSnack('Integration disconnected', isError: false);
    } catch (e) {
      if (mounted) _showSnack('Failed to disconnect: $e', isError: true);
    }
  }

  void _showConnectDialog(Map<String, dynamic> provider) {
    final fields      = provider['configFields'] as List;
    final controllers = fields.map((_) => TextEditingController()).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 20),
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (provider['color'] as Color).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(provider['icon'] as IconData,
                      color: provider['color'] as Color, size: 22),
                ),
                const SizedBox(width: 14),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Connect ${provider['name']}',
                      style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold)),
                  Text(provider['description'] as String,
                      style: GoogleFonts.inter(
                          color: Colors.white38, fontSize: 12)),
                ]),
              ]),
              const SizedBox(height: 24),
              ...List.generate(fields.length, (i) {
                final field    = fields[i] as Map;
                final optional = field['optional'] == true;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: TextField(
                    controller: controllers[i],
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: field['label'] as String,
                      labelStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                      hintText: optional ? 'Optional' : null,
                      hintStyle: const TextStyle(color: Colors.white24, fontSize: 13),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.05),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                            color: Color(0xFF8B5CF6), width: 1.5),
                      ),
                    ),
                  ),
                );
              }),
              const SizedBox(height: 8),
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
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    final config = <String, dynamic>{};
                    for (int i = 0; i < fields.length; i++) {
                      config[(fields[i] as Map)['key']] =
                          controllers[i].text.trim();
                    }
                    Navigator.pop(context);
                    _connectIntegration(provider['id'] as String, config);
                  },
                  child: Text('Connect ${provider['name']}',
                      style: GoogleFonts.inter(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSnack(String msg, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(isError ? LucideIcons.alertCircle : LucideIcons.checkCircle,
            color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Expanded(
            child: Text(msg,
                style: GoogleFonts.inter(color: Colors.white, fontSize: 14))),
      ]),
      backgroundColor:
          isError ? const Color(0xFFEF4444) : const Color(0xFF10B981),
      behavior: SnackBarBehavior.floating,
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Integrations',
            style: GoogleFonts.outfit(
                color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: const Color(0xFF10B981).withOpacity(0.3)),
              ),
              child: Text(
                '${_activeIntegrations.length} active',
                style: GoogleFonts.inter(
                    color: const Color(0xFF10B981),
                    fontSize: 11,
                    fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchIntegrations,
        color: const Color(0xFF8B5CF6),
        backgroundColor: const Color(0xFF1E293B),
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF8B5CF6)))
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                itemCount: _providers.length,
                itemBuilder: (context, index) {
                  final provider = _providers[index];
                  final active   = _activeIntegrations.cast<Map<String, dynamic>?>()
                      .firstWhere(
                        (i) => i?['provider'] == provider['id'],
                        orElse: () => null,
                      );
                  final isConnected = active != null;

                  return _ProviderCard(
                    provider: provider,
                    isConnected: isConnected,
                    onConnect: () => _showConnectDialog(provider),
                    onDisconnect: () =>
                        _disconnectIntegration(active!['id'] as String),
                  );
                },
              ),
      ),
    );
  }
}

// ── Provider card widget ───────────────────────────────────────────────────────

class _ProviderCard extends StatelessWidget {
  const _ProviderCard({
    required this.provider,
    required this.isConnected,
    required this.onConnect,
    required this.onDisconnect,
  });

  final Map<String, dynamic> provider;
  final bool isConnected;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context) {
    final color = provider['color'] as Color;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isConnected
              ? const Color(0xFF10B981).withOpacity(0.35)
              : Colors.white.withOpacity(0.07),
          width: isConnected ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(provider['icon'] as IconData, color: color, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(provider['name'] as String,
                    style: GoogleFonts.outfit(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 3),
                Text(provider['description'] as String,
                    style: GoogleFonts.inter(
                        color: Colors.white38, fontSize: 12)),
                if (isConnected) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    const Icon(Icons.circle,
                        color: Color(0xFF10B981), size: 7),
                    const SizedBox(width: 5),
                    Text('Connected',
                        style: GoogleFonts.inter(
                            color: const Color(0xFF10B981),
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ]),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isConnected
                  ? Colors.white.withOpacity(0.06)
                  : const Color(0xFF8B5CF6),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: isConnected ? onDisconnect : onConnect,
            child: Text(
              isConnected ? 'Disconnect' : 'Connect',
              style: GoogleFonts.inter(
                color: isConnected ? const Color(0xFFEF4444) : Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
