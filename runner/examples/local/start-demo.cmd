@echo off
rem Starts BuildAI, THE EYE and the TestSphere Console for a demo, and opens them.
rem Keep this window open during the demo; press Ctrl+C to stop everything.
title TestSphere demo
chcp 65001 >nul
cd /d "%~dp0..\.."
node examples\local\demo.mjs %*
if errorlevel 1 pause
