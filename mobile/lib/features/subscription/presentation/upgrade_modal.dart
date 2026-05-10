import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/chat/providers/chat_provider.dart';

class UpgradeModal extends ConsumerStatefulWidget {
  const UpgradeModal({super.key});

  @override
  ConsumerState<UpgradeModal> createState() => _UpgradeModalState();
}

class _UpgradeModalState extends ConsumerState<UpgradeModal> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 24),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A).withOpacity(0.8),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: const Color(0xFF8B5CF6).withOpacity(0.3)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF8B5CF6).withOpacity(0.1),
                blurRadius: 40,
                spreadRadius: 10,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Premium Icon
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFACC15), Color(0xFFEAB308)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: const Color(0xFFEAB308).withOpacity(0.4), blurRadius: 20),
                  ],
                ),
                child: const Icon(LucideIcons.crown, color: Colors.white, size: 40),
              ),
              const SizedBox(height: 24),
              
              Text(
                'Limit Reached!',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 12),
              
              Text(
                'You have reached your 50-message limit for today. Upgrade to Pro for unlimited access and elite features.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  color: const Color(0xFF94A3B8),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              
              // Upgrade Button
              _buildButton(
                'Upgrade to Pro',
                const Color(0xFF8B5CF6),
                () async {
                  setState(() => _isLoading = true);
                  
                  try {
                    await ref.read(chatProvider).startStripeUpgrade();
                    
                    if (context.mounted) {
                      Navigator.pop(context); // Close modal when checkout opens
                    }
                  } catch (e) {
                    setState(() => _isLoading = false);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Failed to open Stripe checkout. Please try again.'),
                          backgroundColor: Colors.redAccent,
                          duration: Duration(seconds: 4),
                        ),
                      );
                    }
                  }
                },
              ),
              const SizedBox(height: 12),
              
              // Maybe Later
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  'Maybe Later',
                  style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildButton(String text, Color color, VoidCallback onTap) {
    return Container(
      width: double.infinity,
      height: 56,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: color.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Center(
            child: _isLoading 
                ? const SizedBox(
                    height: 24, 
                    width: 24, 
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
                  )
                : Text(
                    text,
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ),
    );
  }
}
