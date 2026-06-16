import json
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, simpledialog, messagebox
from PIL import Image, ImageTk


class BBoxTool:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.image_path = filedialog.askopenfilename(
            title="Selecione a imagem do template",
            filetypes=[("Images", "*.png;*.jpg;*.jpeg")]
        )
        if not self.image_path:
            self.root.destroy()
            return
        self.image = Image.open(self.image_path)
        self.tk_image = ImageTk.PhotoImage(self.image)
        self.canvas = tk.Canvas(root, width=self.image.width, height=self.image.height)
        self.canvas.pack()
        self.canvas.create_image(0, 0, anchor="nw", image=self.tk_image)
        self.start = None
        self.active_rect = None
        self.bboxes = []
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.root.bind("s", self.save_json)
        self.root.bind("u", self.undo)

    def on_press(self, event):
        self.start = (event.x, event.y)
        if self.active_rect:
            self.canvas.delete(self.active_rect)
        self.active_rect = self.canvas.create_rectangle(event.x, event.y, event.x, event.y, outline="red", width=2)

    def on_drag(self, event):
        if not self.start or not self.active_rect:
            return
        self.canvas.coords(self.active_rect, self.start[0], self.start[1], event.x, event.y)

    def on_release(self, event):
        if not self.start or not self.active_rect:
            return
        x1, y1 = self.start
        x2, y2 = event.x, event.y
        left = int(min(x1, x2))
        top = int(min(y1, y2))
        width = int(abs(x2 - x1))
        height = int(abs(y2 - y1))
        if width < 2 or height < 2:
            self.canvas.delete(self.active_rect)
            self.active_rect = None
            self.start = None
            return
        label = simpledialog.askstring("ID", "ID do bbox:")
        if not label:
            self.canvas.delete(self.active_rect)
            self.active_rect = None
            self.start = None
            return
        label = label.strip()
        bbox = [left, top, width, height]
        self.bboxes.append({"id": label, "bbox": bbox})
        self.canvas.itemconfig(self.active_rect, outline="green")
        self.canvas.create_text(left + 4, top - 8, anchor="nw", text=label, fill="green")
        self.active_rect = None
        self.start = None

    def redraw(self):
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor="nw", image=self.tk_image)
        for item in self.bboxes:
            x, y, w, h = item["bbox"]
            self.canvas.create_rectangle(x, y, x + w, y + h, outline="green", width=2)
            self.canvas.create_text(x + 4, y - 8, anchor="nw", text=item["id"], fill="green")

    def undo(self, event=None):
        if not self.bboxes:
            return
        self.bboxes.pop()
        self.redraw()

    def save_json(self, event=None):
        if not self.bboxes:
            messagebox.showinfo("BBox Tool", "Nenhum bbox para salvar.")
            return
        out_path = Path(self.image_path)
        out_file = out_path.with_name(f"{out_path.stem}_bboxes.json")
        payload = {"image": str(out_path), "bboxes": self.bboxes}
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        self.root.clipboard_clear()
        self.root.clipboard_append(json.dumps(self.bboxes, ensure_ascii=False))
        messagebox.showinfo("BBox Tool", f"Salvo em {out_file} e copiado para o clipboard.")


def main():
    root = tk.Tk()
    root.title("BBox Tool")
    BBoxTool(root)
    root.mainloop()


if __name__ == "__main__":
    main()
