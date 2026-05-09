import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/core/theme.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';
import 'package:mobile/features/chat/presentation/chat_screen.dart';
import 'package:mobile/features/auth/presentation/splash_screen.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  try {
    WidgetsFlutterBinding.ensureInitialized();
    
    // Load .env
    print("Loading .env file...");
    await dotenv.load(fileName: ".env");
    
    print("Initializing Hive...");
    await Hive.initFlutter();
    await Hive.openBox('settings');
    await Hive.openBox('chat_history');

    print("Checking Credentials...");
    final supabaseUrl = dotenv.env['SUPABASE_URL'] ?? const String.fromEnvironment('SUPABASE_URL');
    final supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? const String.fromEnvironment('SUPABASE_ANON_KEY');

    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      print("⚠️ WARNING: Supabase credentials not found! Use --dart-define to set them.");
    }

    print("Initializing Supabase...");
    await Supabase.initialize(
      url: supabaseUrl.isNotEmpty ? supabaseUrl : 'https://placeholder.supabase.co',
      anonKey: supabaseAnonKey.isNotEmpty ? supabaseAnonKey : 'placeholder',
    );

    print("Starting App...");
    runApp(
      const ProviderScope(
        child: LuminaAIApp(),
      ),
    );
  } catch (e, stack) {
    print("CRITICAL ERROR DURING INIT: $e");
    print(stack);
    // Show a simple error app instead of white screen
    runApp(MaterialApp(
      home: Scaffold(
        body: Center(child: Text("App Load Error: $e", style: const TextStyle(color: Colors.red))),
      ),
    ));
  }
}

class LuminaAIApp extends StatelessWidget {
  const LuminaAIApp({super.key});

  @override
  Widget build(BuildContext context) {
    // We wrap this in a try-catch to avoid white screen on build errors
    try {
      final session = Supabase.instance.client.auth.currentSession;
      return MaterialApp(
        title: 'LuminaAI',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const SplashScreen(),
      );
    } catch (e) {
      return MaterialApp(
        home: Scaffold(body: Center(child: Text("UI Error: $e"))),
      );
    }
  }
}
