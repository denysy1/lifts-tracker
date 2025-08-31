# Lifts Tracker

Lifts Tracker is a Progressive Web App (PWA) designed to give you a flexible way to track your progress in the 5/3/1 program, without needing to follow a strict schedule. It supports asynchronous tracking of the four main lifts, incorporating autoregulation, automated deload week scheduling, and advanced programming concepts like Leader and Anchor blocks from the 5/3/1 Forever program.

## Features
- **Asynchronous Tracking**: Track lifts independently without being tied to a rigid schedule.
- **Autoregulation**: Automatically adjusts your training max based on AMRAP performance to ensure sustainable progression.
- **Deload Scheduling**: Deload weeks are automatically triggered when performance metrics indicate a need for recovery.
- **Leader and Anchor Blocks**: Implements the 5/3/1 Forever block programming for structured progression (this is turned off by default).
- **Adaptive increment tuning**: each cycle the app looks back at your last N AMRAP results and can shrink or grow your base increment automatically
- **Data Backup & Restore**: Export your complete training history to a JSON file for safekeeping, and restore from backup when needed.
- **Offline Functionality**: Works offline after installation and behaves like a native app.

## Mobile Installation Instructions

### For iPhone (iOS)
1. Open the app URL in Safari: [Lifts Tracker](https://denysy1.github.io/lifts-tracker).
2. Tap the Share icon at the bottom of the screen.
3. Scroll down and tap Add to Home Screen.
4. Tap Add in the top right corner. The app icon will appear on your home screen.

### For Android
1. Open the app URL in Chrome: [Lifts Tracker](https://denysy1.github.io/lifts-tracker).
2. Tap the Menu icon (three vertical dots) in the top right corner.
3. Select Add to Home screen.
4. Tap Add and confirm. The app icon will now appear on your home screen.

Once installed, the app will work offline and behave like a native app.

## Training Programming

### Autoregulation Based on AMRAP Performance
Lifts Tracker dynamically adjusts your training max based on your performance in the AMRAP set of each cycle. If you hit at least 1 rep, your training max will increase by the standard increment. For every 5 additional reps (10, 15, 20, etc.), an extra 5 lbs is added, allowing faster progression when you exceed targets without overloading. This adaptive approach helps keep your lifts challenging yet achievable, promoting sustainable strength gains over time.

### Deload Weeks for Optimal Recovery
Lifts Tracker automatically schedules a deload week when needed to help prevent burnout and overtraining. If you complete two consecutive cycles with fewer than 5 reps in the final AMRAP set of Week 3, the app will trigger a deload week. During this week, you’ll lift the same weights but with about 30% fewer reps, allowing for active recovery without losing progress. This adaptive feature ensures you stay on track, promoting steady gains while giving your body time to recover.

### Leader and Anchor Blocks
Lifts Tracker incorporates the Leader and Anchor programming from the 5/3/1 Forever program:
- **Leader Blocks**: Focus on base strength development with high volume and straightforward progression. During Leader blocks, prescribed sets follow the "5s PRO" format, using fixed percentages (65%, 75%, 85%) and 5 reps per set.
- **Anchor Blocks**: Transition to lower volume, higher intensity work to peak strength. Each week in an Anchor block progresses with increasing intensity:
  - Week 1: 65%, 75%, 85% for 5 reps each.
  - Week 2: 70%, 80%, 90% for 3 reps each.
  - Week 3: 75%, 85%, 95% for 5, 3, and 1 rep, respectively.

Each training cycle alternates between Leader and Anchor blocks, ensuring balanced progression and recovery.

### Customizable Configurations

Lifts Tracker allows users to fine-tune their training preferences by importing a configuration file (use the config.JSON file as a template). Parameters such as AMRAP thresholds, deload percentages, training max multipliers, and block cycles can be customized to match your individual training style.

#### How to Upload a Configuration File
1. Click the **Import Config** button in the app interface.
2. Select a modified config.JSON file.
3. The configuration will be saved and applied immediately in the current session.
