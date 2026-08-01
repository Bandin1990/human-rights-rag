Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "D:\human-rights-rag"
shell.Run "cmd.exe /d /k ""D:\human-rights-rag\scripts\streamlit_server.cmd""", 1, False
