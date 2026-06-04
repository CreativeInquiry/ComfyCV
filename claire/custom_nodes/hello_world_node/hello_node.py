class HelloWorldNode:
    """
    The simplest possible ComfyUI node.
    Takes a text input, returns it with a greeting.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "your_name": ("STRING", {"default": "world"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("greeting",)
    FUNCTION = "greet"
    CATEGORY = "tutorials/hello-world"

    def greet(self, your_name):
        message = f"Hey hey,, {your_name}! looks like your custom node works!"
        print(f"[HelloWorld] {message}")  # shows in the ComfyUI terminal
        return (message,)


# These two dicts are what ComfyUI actually reads at startup
NODE_CLASS_MAPPINGS = {
    "HelloWorld": HelloWorldNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HelloWorld": "Hello World :)",
}