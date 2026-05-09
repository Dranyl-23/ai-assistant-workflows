import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryViolet = Color(0xFF8B5CF6);
  static const Color secondaryIndigo = Color(0xFF6366F1);
  static const Color darkBackground = Color(0xFF0F172A);
  static const Color cardBackground = Color(0xFF1E293B);
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color borderGlow = Color(0x338B5CF6);

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: primaryViolet,
        secondary: secondaryIndigo,
        surface: cardBackground,
      ),
      textTheme: GoogleFonts.outfitTextTheme(
        const TextTheme(
          headlineLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w800, fontSize: 32),
          headlineMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w700, fontSize: 24),
          titleLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 20),
          bodyLarge: TextStyle(color: textPrimary, fontSize: 16),
          bodyMedium: TextStyle(color: textMuted, fontSize: 14),
        ),
      ),
      cardTheme: CardTheme(
        color: cardBackground.withOpacity(0.5),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: borderGlow),
        ),
      ),
    );
  }
}
