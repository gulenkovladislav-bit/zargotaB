#!/bin/zsh
app_path="${0:A:h}/Обмен эпизодами.app"
if [[ -d "$app_path" ]]; then
  /usr/bin/open "$app_path"
else
  print 'Положите запускатель рядом с «Обмен эпизодами.app». / Покладіть запускач поруч із «Обмен эпизодами.app».'
fi
