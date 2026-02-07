import numpy as np
import pandas as pd
import datetime
import os

from rank_generator import search_df

def generate_history(user_id, category, timeframe, ref_time):
    print(search_df(user_id, category, timeframe, ref_time))

if __name__ == "__main__":
    user_id = "EuLe21"
    category = "gas_transport"
    timeframe = "m"
    ref_time = datetime.datetime(2019, 2, 15)
    generate_history(user_id, category, timeframe, ref_time)