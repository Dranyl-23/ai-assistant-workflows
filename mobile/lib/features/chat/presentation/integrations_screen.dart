import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

class IntegrationsScreen extends StatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  State<IntegrationsScreen> createState() => _IntegrationsScreenState();
}

class _IntegrationsScreenState extends State<IntegrationsScreen> {
  List<Map<String, dynamic>> _activeIntegrations = [];
  bool _isLoading = true;

  final List<Map<String, dynamic>> _providers = [
    {
      'id': 'github',
      'name': 'GitHub',
      'description': 'Allow AI to read repos and create PRs',
      'icon': LucideIcons.github,
      'color': const Color(0xFF333333),
      'configFields': [
        {'label': 'Personal Access Token', 'key': 'accessToken'}
      ],
    },
    {
      'id': 'n8n',
      'name': 'N8N Webhooks',
      'description': 'Trigger advanced automated workflows',
      'icon': LucideIcons.workflow,
      'color': const Color(0xFFFF6B6B),
      'configFields': [
        {'label': 'Webhook URL', 'key': 'webhookUrl'},
        {'label': 'Auth Header (Optional)', 'key': 'authHeader'}
      ],
    },
    {
      'id': 'discord',
      'name': 'Discord',
      'description': 'Send notifications and manage servers',
      'icon': LucideIcons.messageSquare,
      'color': const Color(0xFF5865F2),
      'configFields': [
        {'label': 'Webhook URL', 'key': 'webhookUrl'},
        {'label': 'Bot Token (Optional)', 'key': 'botToken'}
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
        _activeIntegrations = List<Map<String, dynamic>>.from(response);
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load integrations: $e')));
      setState(() => _isLoading = false);
    }
  }

  Future<void> _connectIntegration(String providerId, Map<String, dynamic> config) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;

    try {
      // Upsert via Supabase SDK (Requires RLS to be configured)
      await Supabase.instance.client.from('integrations').upsert({
        'user_id': user.id,
        'provider': providerId,
        'status': 'active',
        'config': config,
        'created_at': DateTime.now().toIso8601String(),
      });
      _fetchIntegrations();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Integration Connected!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Connection failed: $e')));
    }
  }

  Future<void> _disconnectIntegration(String id) async {
    try {
      await Supabase.instance.client.from('integrations').delete().eq('id', id);
      _fetchIntegrations();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Integration Disconnected')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to disconnect: $e')));
    }
  }

  void _showConnectDialog(Map<String, dynamic> provider) {
    final controllers = provider['configFields'].map((_) => TextEditingController()).toList();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: Text('Connect ${provider['name']}', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(provider['description'], style: GoogleFonts.inter(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 16),
                ...List.generate(provider['configFields'].length, (index) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: TextField(
                      controller: controllers[index],
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: provider['configFields'][index]['label'],
                        labelStyle: const TextStyle(color: Colors.white54, fontSize: 12),
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.05),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6)),
              onPressed: () {
                Map<String, dynamic> config = {};
                for (int i = 0; i < provider['configFields'].length; i++) {
                  final field = provider['configFields'][i];
                  config[field['key']] = controllers[i].text.trim();
                }
                Navigator.pop(context);
                _connectIntegration(provider['id'], config);
              },
              child: Text('Connect', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Agentic Integrations', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchIntegrations,
        color: const Color(0xFF8B5CF6),
        backgroundColor: const Color(0xFF1E293B),
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6)))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _providers.length,
                itemBuilder: (context, index) {
                final provider = _providers[index];
                final activeIntegration = _activeIntegrations.cast<Map<String, dynamic>?>().firstWhere(
                  (integration) => integration?['provider'] == provider['id'],
                  orElse: () => null,
                );
                final isConnected = activeIntegration != null;

                return Card(
                  color: Colors.white.withOpacity(0.05),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: isConnected ? const Color(0xFF10B981).withOpacity(0.3) : Colors.transparent),
                  ),
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: provider['color'].withOpacity(0.2),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(provider['icon'], color: provider['color'], size: 28),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(provider['name'], style: GoogleFonts.outfit(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 4),
                                  Text(provider['description'], style: GoogleFonts.inter(color: Colors.white54, fontSize: 13)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (isConnected)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.5)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.circle, color: Color(0xFF10B981), size: 8),
                                    const SizedBox(width: 6),
                                    Text('Connected', style: GoogleFonts.inter(color: const Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              )
                            else
                              Text('Not Connected', style: GoogleFonts.inter(color: Colors.white38, fontSize: 12)),
                            
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isConnected ? Colors.white.withOpacity(0.1) : const Color(0xFF8B5CF6),
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: () {
                                if (isConnected) {
                                  _disconnectIntegration(activeIntegration['id']);
                                } else {
                                  _showConnectDialog(provider);
                                }
                              },
                              child: Text(
                                isConnected ? 'Disconnect' : 'Connect',
                                style: GoogleFonts.inter(color: isConnected ? Colors.redAccent : Colors.white, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      ),
    );
  }
}
