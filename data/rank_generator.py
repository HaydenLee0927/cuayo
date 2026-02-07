import numpy as np
import pandas as pd

from dataset_prep import clean_dataset

def add_salary(df):
    # Add a salary column with random values from 35k to 300k, rounding to nearest 1000
    df['salary'] = np.random.randint(35000, 300000, size=len(df))
    df['salary'] = (df['salary'] / 1000).round() * 1000
    return df