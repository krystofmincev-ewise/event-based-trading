# Effectively — The size of an edge

[Download the slide app](https://github.com/krystofmincev-ewise/event-based-trading/raw/refs/heads/main/docs/slide-app/index.html) or use the included [index.html](index.html). This single HTML file contains all ten animated chapters, narration, source links, and the coin and option-sizing experiments. It requires no build, backend, API key, or video files.

## Open chapter 10

From the repository root, run:

```sh
python3 -m http.server 4196 --bind 127.0.0.1 --directory docs/slide-app
```

Open [chapter 10: The portfolio has the final word](http://127.0.0.1:4196/index.html?part=10&scene=0&autoplay=0). This is the animated slide counterpart of Short 10, “A good trade can deserve a position size of zero.” Use the chapter menu to explore the rest of the app.

GitHub's file viewer shows HTML source; the local server runs the app. External source links require an internet connection.

## Controls

- Left/Right: previous or next scene.
- Space: pause or resume. R: replay the scene.
- Script: narration and citations. Lab: interactive experiments.
- Escape: close an overlay.

The app is copied unchanged from the local portable course export, `presentations/effectively-v5/deliverables/effectively-the-size-of-an-edge.html`. The recording desk depends on local MP4 masters, so it is not included in this portable edition. Recordings, rendered media, PDFs, and production outputs stay outside Git.

The examples preserve their original assumptions and research limitations. They do not establish a live trading edge.
