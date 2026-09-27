@echo off
rem Pull, check, commit, push and deploy SwimTrack in one go. Works from any folder: ship --help
node "%~dp0scripts\ship.mjs" %*
