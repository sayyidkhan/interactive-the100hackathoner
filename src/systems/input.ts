export type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpRequested: boolean;
  inspectRequested: boolean;
};

export type InputControl = "forward" | "backward" | "left" | "right" | "sprint" | "jump" | "inspect";

export function createInput(): InputState {
  const input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jumpRequested: false,
    inspectRequested: false
  };

  const setKey = (event: KeyboardEvent, active: boolean) => {
    const key = event.key.toLowerCase();
    if (["w", "arrowup"].includes(key)) input.forward = active;
    if (["s", "arrowdown"].includes(key)) input.backward = active;
    if (["a", "arrowleft"].includes(key)) input.left = active;
    if (["d", "arrowright"].includes(key)) input.right = active;
    if (key === "shift") input.sprint = active;
    if (key === " " && active) {
      input.jumpRequested = true;
      event.preventDefault();
    }
    if (["e", "f"].includes(key) && active) {
      input.inspectRequested = true;
      event.preventDefault();
    }
  };

  window.addEventListener("keydown", (event) => setKey(event, true));
  window.addEventListener("keyup", (event) => setKey(event, false));

  return input;
}

export function setInputControl(input: InputState, control: InputControl, active: boolean): void {
  if (control === "forward") input.forward = active;
  if (control === "backward") input.backward = active;
  if (control === "left") input.left = active;
  if (control === "right") input.right = active;
  if (control === "sprint") input.sprint = active;
  if (control === "jump" && active) input.jumpRequested = true;
  if (control === "inspect" && active) input.inspectRequested = true;
}
