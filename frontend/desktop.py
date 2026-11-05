
import webview

# Create the DocBuddy desktop window
window = webview.create_window(
    title="DocBuddy",
    url="http://localhost:5173",
    width=1400,
    height=900,
    min_size=(900, 600),
    background_color="#0B1020"
)

# Start the desktop application
webview.start()
