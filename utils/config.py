from enum import StrEnum
from json import load

global __configs__
global __config_base_path__

__configs__ = {}
__config_base_path__ = 'configs/'


class ConfigOptions(StrEnum):
    CHANNELS = 'channels'
    ROLES = 'roles'

    @classmethod
    def ALL(cls) -> list['ConfigOptions']:
        return [option for option in cls]


def load_config(config: ConfigOptions | list[ConfigOptions]) -> None:
    # If a list is given, load each config in the list using 1 depth recursion
    if isinstance(config, list):
        for c in config:
            load_config(c)
        return

    # If it's already loaded, skip
    if config in __configs__:
        return

    # Load the config from the JSON file
    with open(f'{__config_base_path__}{config}.json', 'r') as conf:
        c = load(conf)
        print(c)
        __configs__[config] = c


def get_config(config: ConfigOptions) -> dict:
    # Load the config if not already loaded
    if config not in __configs__:
        load_config(config)

    return __configs__[config]
