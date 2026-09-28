import json
import webbrowser
from pathlib import Path


def search_tree_graph(result):
    interface = Path(__file__).resolve().parents[1] / "interface"
    data_file = interface / "js" / "tree_data.js"

    data_file.write_text(
        "window.treeResult = "
        + json.dumps(result, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    page = (interface / "pages" / "tree.html").resolve().as_uri()
    webbrowser.open(page)