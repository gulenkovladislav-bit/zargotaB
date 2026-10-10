#!/bin/zsh
set -e
cd "${0:A:h:h}"
app_dir="$PWD/Обмен эпизодами.app"
mkdir -p "$app_dir/Contents/MacOS"
/usr/bin/xcrun swiftc -sdk /Library/Developer/CommandLineTools/SDKs/MacOSX15.5.sdk -swift-version 5 -module-cache-path /tmp/zargota-swift-cache scripts/native-exchange/main.swift -o "$app_dir/Contents/MacOS/Exchange" -framework Cocoa
cat > "$app_dir/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Exchange</string><key>CFBundleIdentifier</key><string>local.zargota.exchange</string><key>CFBundleName</key><string>Zargota Exchange</string><key>CFBundleDisplayName</key><string>Обмен эпизодами</string><key>CFBundlePackageType</key><string>APPL</string><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST

/usr/libexec/PlistBuddy -c "Add :ZGProjectRoot string $PWD" "$app_dir/Contents/Info.plist"
/usr/bin/codesign --force --deep --sign - "$app_dir"
