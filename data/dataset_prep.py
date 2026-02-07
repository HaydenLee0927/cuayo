import pandas as pd
import numpy as np
import datetime

START_OF_2019 = 1325376018 # UNIX TIME FOR JAN 1 2019 in dataset
TIME_ADJUST_FACTOR = int(datetime.datetime(2019, 1, 1).timestamp()) - START_OF_2019

# set a seed for reproducibility
np.random.seed(42)

def bring_dataset():
    splits = {'train': 'credit_card_transaction_train.csv', 'test': 'credit_card_transaction_test.csv'}
    df = pd.read_csv("hf://datasets/pointe77/credit-card-transaction/" + splits["train"])
    print(df.shape)
    #print(df.tail())
    return df

def clean_dataset():
    df = bring_dataset()
    

    # Remove unrelevant columns
    df = df.drop(columns=['Unnamed: 0', 'cc_num','trans_date_trans_time', 'street', 'lat', 'long', 'merchant', 
                          'city_pop', 'job', 'merch_lat', 'merch_long', 'zip', 'merch_zipcode', 'is_fraud', 'trans_num'])
    
    # Convert dobb to age in 2019
    df['age'] = 2019 - pd.to_datetime(df['dob']).dt.year
    df = df.drop(columns=['dob'])
    
    """# Write the cleaned dataset to a new CSV file
    df.to_csv("credit_card_transaction.csv", index=False)"""

    # Create user_id column
    df['user_id'] = df['first'].str[0:2] + df['last'].str[0:2] + df['age'].astype(str)

    # For each First Name + Last Name combination, 
    # create a salary column with random values from 35k to 300k, rounding to nearest 1000
    # Sample the random value from a normal distribution with mean 100k and std 50k, and clip the values to be between 35k and 300k
    df['name'] = df['first'] + ' ' + df['last']
    df = df.drop(columns=['first', 'last'])
    salary_map = {}
    for name in df['user_id'].unique():
        salary = np.random.normal(100000, 50000)
        salary = np.clip(salary, 35000, 300000)
        salary = (salary / 1000).round() * 1000
        salary_map[name] = salary
    
    df['salary'] = df['user_id'].map(salary_map)

    # adjust time by TIME_ADJUST_FACTOR
    df['unix_time'] = df['unix_time'] + TIME_ADJUST_FACTOR

    # convert category column such that it drops _pos and _net suffixes
    df['category'] = df['category'].str.replace('_pos', '')
    df['category'] = df['category'].str.replace('_net', '')

    df = df.dropna()

    # Write the cleaned dataset to a new CSV file
    df.to_csv("credit_card_transaction.csv", index=False)

    # Print column names of df
    print(df.columns)

    return df

if __name__ == "__main__":
    df = clean_dataset()
    print(df.shape)