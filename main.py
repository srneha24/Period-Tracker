from typer import Option, Typer

app = Typer()


@app.command()
def main(name: str = Option(..., prompt="What is your name?")):
    print(f"Hello there, {name}!")


if __name__ == "__main__":
    app()
