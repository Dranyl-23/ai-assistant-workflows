import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/core/theme.dart';
import 'package:mobile/features/auth/presentation/splash_screen.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// ─── Build-time Configuration ──────────────────────────────────────────────
///
/// All sensitive values are injected at compile time via --dart-define.
/// They are NOT read from a .env file bundled in the APK/IPA.
///
/// Local development (flutter run):
///   flutter run \
///     --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=eyJ... \
///     --dart-define=BACKEND_URL=http://10.0.2.2:5000
///
/// CI / Render / GitHub Actions:
///   Store the values as Repository Secrets and inject via the build command.
///
/// VS Code (launch.json):
///   "toolArgs": [
///     "--dart-define=SUPABASE_URL=${env:SUPABASE_URL}",
///     "--dart-define=SUPABASE_ANON_KEY=${env:SUPABASE_ANON_KEY}",
///     "--dart-define=BACKEND_URL=${env:BACKEND_URL}"
///   ]
///
/// IMPORTANT: Do NOT add the .env file back to pubspec.yaml assets.
/// The .env file is for local reference only and must be in .gitignore.
/// ───────────────────────────────────────────────────────────────────────────

const _kSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _kSupabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const _kBackendUrl = String.fromEnvironment('BACKEND_URL');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Validate required config
  if (_kSupabaseUrl.isEmpty || _kSupabaseAnonKey.isEmpty) {
    // In debug mode, show a helpful error instead of a cryptic crash
    if (kDebugMode) {
      debugPrint('''
╔══════════════════════════════════════════════════════════════════╗
║  MISSING CONFIGURATION                                          ║
║  Run the app with:                                              ║
║    flutter run                                                  ║
║      --dart-define=SUPABASE_URL=https://xxx.supabase.co        ║
║      --dart-define=SUPABASE_ANON_KEY=eyJ...                    ║
║      --dart-define=BACKEND_URL=http://10.0.2.2:5000            ║
╚══════════════════════════════════════════════════════════════════╝
''');
    }
    runApp(const _ConfigErrorApp());
    return;
  }

  try {
    // Hive local storage
    await Hive.initFlutter();
    await Hive.openBox('settings');
    await Hive.openBox('chat_history');

    // Supabase — using compile-time injected values (not .env)
    await Supabase.initialize(
      url: _kSupabaseUrl,
      anonKey: _kSupabaseAnonKey,
    );

    if (kDebugMode) {
      debugPrint('[App] Supabase initialised. Backend: ${_kBackendUrl.isNotEmpty ? _kBackendUrl : "default (10.0.2.2:5000)"}');
    }

    runApp(
      const ProviderScope(
        child: LuminaAIApp(),
      ),
    );
  } catch (e, stack) {
    if (kDebugMode) {
      debugPrint('[App] CRITICAL INIT ERROR: $e');
      debugPrint('$stack');
    }
    runApp(MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF020617),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Initialisation Error:\n$e',
              style: const TextStyle(color: Colors.redAccent, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    ));
  }
}

class LuminaAIApp extends StatelessWidget {
  const LuminaAIApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LuminaAI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const SplashScreen(),
    );
  }
}

/// Shown when required --dart-define values are missing.
class _ConfigErrorApp extends StatelessWidget {
  const _ConfigErrorApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF020617),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 56),
                const SizedBox(height: 24),
                const Text(
                  'Missing Configuration',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Run the app with required --dart-define flags.\nSee main.dart for instructions.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
