@echo off
rem Pull, check, commit, push and deploy Lanemark in one go. Works from any folder: ship --help
node "%~dp0scripts\ship.mjs" %*
