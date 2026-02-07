import numpy as np
import pandas as pd
import datetime



def search_df(user_id, category, time, ref_time, state=None):
    """
    :param user_id: user_id of the user we want to find the rank and spent ratio for
    :param category: category of transactions to consider
        Possible categories:
        {'food_dining', 'travel', 'entertainment', 'personal_care', 'grocery', 
        'health_fitness', 'kids_pets', 'misc', 'gas_transport', 'home', 'shopping'}
    :param time: time window to consider, either daily (d), weekly (w), or monthly (m)
    :param ref_time: reference time in datetime format
    :param state: state to create rank
    :return:
    user_spent_ratio: the spent ratio of the user_id in the given category, time window and state
    user_rank: the rank of the user_id in the given category, time window and state
    top_users: the list of user_ids of top 3 ranked users and the user of rank 
               right before me and after me, and the list of spent_ratio of those users
    top_spent_ratios: the list of spent_ratio of top 3 ranked users and the user of rank
                     right before me and after me

    Note that user_spent_ratio = 0 and user_rank = None 
            if the user hasn't spent money on category over time frame
    Note that top_users = top_spent_ratios = [] 
            if there are no transactions in category at all over time frame
    """
    df = pd.read_csv("credit_card_transaction.csv")
    #print(df.head())
    # Category: filter by category
    df = df[df['category'] == category]
    # State: if not none, filter by state
    if state is not None:
        df = df[df['state'] == state]
    # Time: time is either daily (d), weekly (w), or monthly (m)
    # ref time is ref time in datetime format
    # convert ref time to unix time
    ref_time_unix = int(ref_time.timestamp())
    # filter by time
    if time == 'd':
        df = df[(df['unix_time'] >= ref_time_unix - 86400) & (df['unix_time'] <= ref_time_unix)]
    elif time == 'w':
        df = df[(df['unix_time'] >= ref_time_unix - 7*86400) & (df['unix_time'] <= ref_time_unix)]
    elif time == 'm':
        df = df[(df['unix_time'] >= ref_time_unix - 30*86400) & (df['unix_time'] <= ref_time_unix)]

    # Aggregate by amt
    amt_spent_user = df.groupby('user_id')['amt'].sum().reset_index()
    #print(amt_spent_user.head())
    # If there is no data for all users
    if amt_spent_user.empty:
        return 0, None, [], []
    #print(df.head())

    # Make a new column spent_ratio = amt / (salary/12) if m, salary/52 if w, salary/365 if d
    salary_ratio = 12 if time == 'm' else 52 if time == 'w' else 365
    amt_spent_user = amt_spent_user.merge(df[['user_id', 'salary']].drop_duplicates(), on='user_id', how='left')
    # Round to 4 digits after decimal
    amt_spent_user['spent_ratio'] = (amt_spent_user['amt'] / (amt_spent_user['salary'] / salary_ratio)).round(4)

    # Rank by spent_ratio
    amt_spent_user['rank'] = amt_spent_user['spent_ratio'].rank(ascending=False, method='min')
    ranked_df = amt_spent_user.sort_values(by='rank')
    #print(ranked_df[ranked_df['user_id'] == user_id])
    #print(ranked_df.head(10))

    # Return the spent_ratio of user_id, rank of user_id and the list of user_ids of top 3 ranked users and the user of rank right before me and after me, and the list of spent_ratio of those users
    # If user_id is in top 3, for the last 2 outputs return the user_ids and spent_ratios of users in the union of top 3 and the rank before and after user_id
    if user_id in ranked_df['user_id'].values:
        user_row = ranked_df[ranked_df['user_id'] == user_id].iloc[0]
        user_spent_ratio = user_row['spent_ratio']
        user_rank = int(user_row['rank'])
        if user_rank <= 5:
            top_users = ranked_df[ranked_df['rank'] <= max(user_rank,3)]['user_id'].tolist()
            top_spent_ratios = ranked_df[ranked_df['rank'] <= max(user_rank,3)]['spent_ratio'].tolist()
            return user_spent_ratio, user_rank, top_users, top_spent_ratios
        else:
            # User rank is greater than 5, so we can return the top 3 and the rank before and after user_id
            # Last two outputs include users in top 3 and surrounding ranks of user_id
            surrounding_users = ranked_df[(ranked_df['rank'] >= user_rank - 1) & (ranked_df['rank'] <= user_rank + 1)]['user_id'].tolist()
            top_users = ranked_df[ranked_df['rank'] <= 3]['user_id'].tolist()
            top_spent_ratios = ranked_df[ranked_df['rank'] <= 3]['spent_ratio'].tolist()
            # Combine top_users and surrounding users
            final_users = top_users + surrounding_users
            final_spent_ratios = []
            for u in final_users:
                final_spent_ratios.append(ranked_df[ranked_df['user_id'] == u]['spent_ratio'].values[0])
            return user_spent_ratio, user_rank, final_users, final_spent_ratios
    else:
        # Return 0, None, top 3 user data
        top_users = ranked_df[ranked_df['rank'] <= 3]['user_id'].tolist()
        top_spent_ratios = ranked_df[ranked_df['rank'] <= 3]['spent_ratio'].tolist()
        return 0, None, top_users, top_spent_ratios
    


if __name__ == "__main__":
    print(search_df('TaCa35', 'grocery', 'm', datetime.datetime(2019, 1, 15)))