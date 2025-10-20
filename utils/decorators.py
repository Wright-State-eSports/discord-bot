from discord.app_commands import commands


def admin(func):
    """
    Decorator to restrict access to admin users only.
    """

    commands.default_permissions(administrator=True)(func)

    return func
