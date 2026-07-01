use thiserror::Error;

#[derive(Error, Debug)]
pub enum RiotError {
    #[error("Network error talking to Riot: {0}")]
    Network(#[from] reqwest::Error),

    #[error("{0}")]
    Auth(String),

    #[error("{0}")]
    Upstream(String),
}

pub type RiotResult<T> = Result<T, RiotError>;

impl From<RiotError> for String {
    fn from(err: RiotError) -> Self {
        err.to_string()
    }
}
