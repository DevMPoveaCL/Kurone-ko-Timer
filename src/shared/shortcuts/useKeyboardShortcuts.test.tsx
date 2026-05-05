// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts, type Shortcut } from "./useKeyboardShortcuts";

function TestComponent({ shortcuts }: { shortcuts: Shortcut[] }) {
  useKeyboardShortcuts(shortcuts);
  return (
    <div>
      <button type="button">Action</button>
      <a href="#">Link</a>
      <input type="text" placeholder="Type here" />
      <textarea placeholder="Textarea" />
      <span data-testid="output">no action</span>
    </div>
  );
}

function ModalTestComponent({ shortcuts }: { shortcuts: Shortcut[] }) {
  useKeyboardShortcuts(shortcuts);
  return (
    <div>
      <button type="button">Action</button>
      <div role="dialog" aria-modal="true">
        <button type="button">Modal button</button>
      </div>
    </div>
  );
}

describe("useKeyboardShortcuts", () => {
  afterEach(() => {
    cleanup();
  });

  it("fires matching shortcut", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "a", description: "A", action }]} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("skips non-Ctrl keys when input is focused", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "a", description: "A", action }]} />);
    screen.getByPlaceholderText("Type here").focus();
    fireEvent.keyDown(window, { key: "a" });
    expect(action).not.toHaveBeenCalled();
  });

  it("allows Ctrl+key even when input is focused", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "ArrowLeft", ctrl: true, description: "Move", action }]} />);
    screen.getByPlaceholderText("Type here").focus();
    fireEvent.keyDown(window, { key: "ArrowLeft", ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("skips when textarea is focused", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "a", description: "A", action }]} />);
    screen.getByPlaceholderText("Textarea").focus();
    fireEvent.keyDown(window, { key: "a" });
    expect(action).not.toHaveBeenCalled();
  });

  it("allows Space as shortcut even when a button is focused", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: " ", description: "Space", action }]} />);
    screen.getByRole("button", { name: "Action" }).focus();
    fireEvent.keyDown(window, { key: " " });
    // Space shortcut fires regardless of button focus — timer action wins
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("blocks non-Escape shortcuts when a modal dialog is open", () => {
    const action = vi.fn();
    render(<ModalTestComponent shortcuts={[{ key: "a", description: "A", action }]} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(action).not.toHaveBeenCalled();
  });

  it("allows Escape when modal is open", () => {
    const action = vi.fn();
    render(<ModalTestComponent shortcuts={[{ key: "Escape", description: "Back", action }]} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("allows Ctrl+key shortcuts even when modal is open", () => {
    const action = vi.fn();
    render(<ModalTestComponent shortcuts={[{ key: "ArrowLeft", ctrl: true, description: "Move", action }]} />);
    fireEvent.keyDown(window, { key: "ArrowLeft", ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("always fires Escape even from input", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "Escape", description: "Back", action }]} />);
    screen.getByPlaceholderText("Type here").focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("fires Ctrl+Shift combo", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "k", ctrl: true, shift: true, description: "C", action }]} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("skips combo when modifiers missing", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "k", ctrl: true, shift: true, description: "C", action }]} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(action).not.toHaveBeenCalled();
  });

  it("matches case-insensitively", () => {
    const action = vi.fn();
    render(<TestComponent shortcuts={[{ key: "A", description: "A", action }]} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("fires only the first matching shortcut", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(<TestComponent shortcuts={[
      { key: "x", description: "First", action: first },
      { key: "x", description: "Second", action: second },
    ]} />);
    fireEvent.keyDown(window, { key: "x" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
