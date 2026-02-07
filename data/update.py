from rank_generator import update_df
import datetime

if __name__ == "__main__":
    update_df(
        user_id="EuLe21",
        category="entertainment",
        time=datetime.datetime(2019, 2, 14, 12, 0),
        amt=23.75,
        state="PA"
    )
