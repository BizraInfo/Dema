# World Adapters — Observers & Actuators

A world adapter pairs perception with action while keeping them independently verifiable.

| World | Observer | Actuator |
|---|---|---|
| Web | crawler/scraper, fresh read | browser automation |
| Linux | D-Bus/process/filesystem/accessibility observation | D-Bus/compositor/native automation/ydotool |
| Windows | UI Automation/process/filesystem observation | AutoHotkey/PowerShell/Win32 |
| macOS | Accessibility/app state | Hammerspoon/AppleScript/App APIs |
| Android | UIAutomator/Accessibility/app state | Intents/Tasker/UIAutomator/ADB under authority |
| Data estate | inventory/parser/index | reversible file steward |
| API/service | GET/read/status | bounded mutation endpoint |

Law: the hand must not certify what the hand did. Important effects require a fresh independent observer and SAT/verifier.
