import numpy as np
import pandas as pd
import datetime
import os

from rank_generator import search_df

def generate_history(user_id, category, timeframe, ref_time, n=10):
    """
    Docstring for generate_history
    
    :param user_id: user id to generate history for
    :param category: category to generate history for, e.g. "gas_transport"
    :param timeframe: time window to consider, either daily (d), weekly (w), or monthly (m)
    :param ref_time: reference time in datetime format
    :param n: number of timeframe history entries to generate, default is 10

    :return: json object with the following format:
    {
        "rank_history": {date: rank, ...},
        "spend_history": {date: spend, ...}
    }
    Rank History: Dictionary of the form {date: rank} for the given category and user_id, where date is the end of the timeframe window
                If the rank is 0 for a given timeframe, do not include that timeframe in the history
    Spend Ratio History: Dictionary of the form {date: spend} for the given category and user_id, where date is the end of the timeframe window       
    Spend Raw History: Dictionary of the form {date: (date of expenditure, amount)} for the given category and user_id, where date is the end of the timeframe window
    Here, both date of expenditure and date are in datetime format.
    Spend Ratio is the ratio of the user's spend in the category to the average spend in that category for the given timeframe.
    Spen Raw contains each individual transaction
    """
    df = pd.read_csv(os.path.join(os.path.dirname(__file__), "credit_card_transaction.csv"))
    rank_history = {}
    spend_ratio_history = {}
    spend_raw_history = {}
    for i in range(n):
        #print(f"Generating history for timeframe {i+1}/{n}...")
        if timeframe == "d":
            end_time = ref_time - datetime.timedelta(days=i)
        elif timeframe == "w":
            end_time = ref_time - datetime.timedelta(weeks=i)
        elif timeframe == "m":
            end_time = ref_time - datetime.timedelta(days=30*i)
            #print(ref_time)
            #print(end_time)
        else:
            raise ValueError("Invalid timeframe. Must be one of 'd', 'w', or 'm'.")
        #print(search_df(user_id, category, timeframe, end_time))
        user_spent_ratio, user_rank, _, _, _ = search_df(user_id, category, timeframe, end_time)
        if user_rank is not None and user_rank > 0:
            rank_history[end_time.strftime("%Y-%m-%d")] = user_rank
        if user_spent_ratio is not None and user_spent_ratio > 0:
            spend_ratio_history[end_time.strftime("%Y-%m-%d")] = user_spent_ratio
        
        # Get raw spend for the user in the category for the timeframe
        df = df[df['category'] == category]
        df = df[df['user_id'] == user_id]
        df = df[df['unix_time'] <= int(end_time.timestamp())]

        if timeframe == "d":
            start_time = end_time - datetime.timedelta(days=1)
        elif timeframe == "w":
            start_time = end_time - datetime.timedelta(weeks=1)
        elif timeframe == "m":
            start_time = end_time - datetime.timedelta(days=30)
        #print(start_time, end_time)
        df = df[df['unix_time'] >= int(start_time.timestamp())]
        spend_raw_history[end_time.strftime("%Y-%m-%d")] = list(zip(df['unix_time'].apply(lambda x: datetime.datetime.fromtimestamp(x)), df['amt']))
    
    return {
        "rank_history": rank_history,
        "spend_ratio_history": spend_ratio_history,
        "spend_raw_history": spend_raw_history
    }


if __name__ == "__main__":
    user_id = "EuLe21"
    category = "gas_transport"
    timeframe = "m"
    ref_time = datetime.datetime(2019, 2, 15)
    #print(generate_history(user_id, category, timeframe, ref_time))