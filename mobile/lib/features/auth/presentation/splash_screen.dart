import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/features/shell/main_shell.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _mainController;
  late AnimationController _floatController;
  late AnimationController _shimmerController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _progressAnimation;
  late AnimationController _rotationController;

  @override
  void initState() {
    super.initState();

    // Main entry animations
    _mainController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _mainController,
      curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
    );

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOutBack),
      ),
    );

    _progressAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.2, 0.9, curve: Curves.easeInOut),
      ),
    );

    // Continuous floating animation
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    // Text shimmer animation
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    // Continuous rotation for the 3D core
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..repeat();

    _mainController.forward();

    // Navigation timer
    Timer(const Duration(milliseconds: 3800), () {
      _navigateToNext();
    });
  }

  void _navigateToNext() {
    if (!mounted) return;
    final session = Supabase.instance.client.auth.currentSession;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => 
          session != null ? const MainShell() : const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 1000),
      ),
    );
  }

  @override
  void dispose() {
    _mainController.dispose();
    _floatController.dispose();
    _shimmerController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: Stack(
        children: [
          // ── Background Particle System ───────────────────────────────────
          const Positioned.fill(child: _AnimatedBackground()),

          // ── Center Content ──────────────────────────────────────────────
          Center(
            child: AnimatedBuilder(
              animation: _mainController,
              builder: (context, child) {
                return FadeTransition(
                  opacity: _fadeAnimation,
                  child: ScaleTransition(
                    scale: _scaleAnimation,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Procedural 3D AI Core
                        _AICoreView(
                          floatAnimation: _floatController,
                          rotationAnimation: _rotationController,
                        ),
                        
                        const SizedBox(height: 50),

                        // Shimmering Title
                        _ShimmerText(
                          text: 'LuminaAI',
                          controller: _shimmerController,
                        ),

                        const SizedBox(height: 12),

                        // Subtitle
                        Text(
                          'INTELLIGENCE REDEFINED',
                          style: GoogleFonts.inter(
                            color: const Color(0xFF94A3B8),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Bottom Progress Section ─────────────────────────────────────
          Positioned(
            bottom: 60,
            left: 40,
            right: 40,
            child: AnimatedBuilder(
              animation: _mainController,
              builder: (context, child) {
                return Opacity(
                  opacity: _fadeAnimation.value,
                  child: Column(
                    children: [
                      // Sleek Progress Bar
                      Container(
                        height: 3,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: _progressAnimation.value,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF8B5CF6), Color(0xFF06B6D4)],
                              ),
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF8B5CF6).withOpacity(0.5),
                                  blurRadius: 10,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'INITIALIZING SYSTEMS...',
                        style: GoogleFonts.inter(
                          color: Colors.white24,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Components ──────────────────────────────────────────────────────────────

class _AICoreView extends StatelessWidget {
  final Animation<double> floatAnimation;
  final Animation<double> rotationAnimation;
  const _AICoreView({required this.floatAnimation, required this.rotationAnimation});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([floatAnimation, rotationAnimation]),
      builder: (context, child) {
        final double floatOffset = math.sin(floatAnimation.value * math.pi * 2) * 15;
        return Transform.translate(
          offset: Offset(0, floatOffset),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer Glow
              Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8B5CF6).withOpacity(0.15),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
              // The Core Painter
              CustomPaint(
                size: const Size(220, 220),
                painter: _CorePainter(rotationAnimation.value),
              ),
              // Inner Glass Orb
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF06B6D4).withOpacity(0.4),
                      const Color(0xFF8B5CF6).withOpacity(0.1),
                    ],
                  ),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.2),
                    width: 0.5,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CorePainter extends CustomPainter {
  final double rotation;
  _CorePainter(this.rotation);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    // Draw 3 rotating rings at different angles to simulate 3D
    _drawRing(canvas, center, 90, 0, const Color(0xFF8B5CF6));
    _drawRing(canvas, center, 100, math.pi / 3, const Color(0xFF06B6D4));
    _drawRing(canvas, center, 80, -math.pi / 3, const Color(0xFF6366F1));
  }

  void _drawRing(Canvas canvas, Offset center, double radius, double tilt, Color color) {
    final path = Path();
    for (int i = 0; i <= 360; i += 5) {
      double angle = (i * math.pi / 180) + (rotation * math.pi * 2);
      
      // Basic 3D projection logic
      double x = math.cos(angle) * radius;
      double y = math.sin(angle) * radius * math.cos(tilt);
      
      if (i == 0) {
        path.moveTo(center.dx + x, center.dy + y);
      } else {
        path.lineTo(center.dx + x, center.dy + y);
      }
    }
    
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withOpacity(0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Draw energy nodes on the ring
    for (int i = 0; i < 3; i++) {
      double nodeAngle = (rotation * math.pi * 2) + (i * math.pi * 2 / 3);
      double nx = math.cos(nodeAngle) * radius;
      double ny = math.sin(nodeAngle) * radius * math.cos(tilt);
      
      canvas.drawCircle(
        Offset(center.dx + nx, center.dy + ny),
        3,
        Paint()..color = color,
      );
      
      // Small node glow
      canvas.drawCircle(
        Offset(center.dx + nx, center.dy + ny),
        8,
        Paint()..color = color.withOpacity(0.2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _ShimmerText extends StatelessWidget {
  final String text;
  final AnimationController controller;
  const _ShimmerText({required this.text, required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return ShaderMask(
          shaderCallback: (rect) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: const [
                Colors.white,
                Color(0xFF8B5CF6),
                Colors.white,
              ],
              stops: [
                (controller.value * 1.5) - 0.5,
                (controller.value * 1.5),
                (controller.value * 1.5) + 0.5,
              ],
            ).createShader(rect);
          },
          child: Text(
            text,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 56,
              fontWeight: FontWeight.w900,
              letterSpacing: -2,
            ),
          ),
        );
      },
    );
  }
}

class _AnimatedBackground extends StatefulWidget {
  const _AnimatedBackground();
  @override
  State<_AnimatedBackground> createState() => _AnimatedBackgroundState();
}

class _AnimatedBackgroundState extends State<_AnimatedBackground> with SingleTickerProviderStateMixin {
  late AnimationController _bgController;
  final List<_Star> _stars = List.generate(40, (index) => _Star());

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
  }

  @override
  void dispose() {
    _bgController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _bgController,
      builder: (context, child) {
        return CustomPaint(
          painter: _StarPainter(_stars, _bgController.value),
        );
      },
    );
  }
}

class _Star {
  final double x = math.Random().nextDouble();
  final double y = math.Random().nextDouble();
  final double size = math.Random().nextDouble() * 2 + 1;
  final double speed = math.Random().nextDouble() * 0.05 + 0.01;
}

class _StarPainter extends CustomPainter {
  final List<_Star> stars;
  final double progress;
  _StarPainter(this.stars, this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withOpacity(0.2);
    for (var star in stars) {
      final double x = star.x * size.width;
      final double y = ((star.y + (progress * star.speed)) % 1.0) * size.height;
      canvas.drawCircle(Offset(x, y), star.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
