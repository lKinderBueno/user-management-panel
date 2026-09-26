package tmdb

import "encoding/json"

// MovieResponse models the TMDB movie details response with appended responses.
type MovieResponse struct {
	ID                  int                  `json:"id"`
	Title               string               `json:"title"`
	OriginalTitle       string               `json:"original_title"`
	Overview            string               `json:"overview"`
	PosterPath          string               `json:"poster_path"`
	BackdropPath        string               `json:"backdrop_path"`
	ReleaseDate         string               `json:"release_date"`
	Runtime             int                  `json:"runtime"`
	VoteAverage         float64              `json:"vote_average"`
	Status              string               `json:"status"`
	Genres              []GenreItem          `json:"genres"`
	ProductionCountries []CountryItem        `json:"production_countries"`
	Videos              VideoContainer       `json:"videos"`
	Credits             CreditContainer      `json:"credits"`
	Images              ImageContainer       `json:"images"`
	Translations        TranslationContainer `json:"translations"`
	Success             *bool                `json:"success,omitempty"` // populated on error by TMDB
	StatusCode          *int                 `json:"status_code,omitempty"`
	StatusMessage       *string              `json:"status_message,omitempty"`
}

// TVResponse models the TMDB TV show details response with appended responses.
type TVResponse struct {
	ID                 int                  `json:"id"`
	Name               string               `json:"name"`
	OriginalName       string               `json:"original_name"`
	Overview           string               `json:"overview"`
	PosterPath         string               `json:"poster_path"`
	BackdropPath       string               `json:"backdrop_path"`
	FirstAirDate       string               `json:"first_air_date"`
	EpisodeRunTime     []int                `json:"episode_run_time"`
	VoteAverage        float64              `json:"vote_average"`
	Status             string               `json:"status"`
	InProduction       bool                 `json:"in_production"`
	CreatedBy          []PersonItem         `json:"created_by"`
	Genres             []GenreItem          `json:"genres"`
	Videos             VideoContainer       `json:"videos"`
	Credits            CreditContainer      `json:"credits"`
	Images             ImageContainer       `json:"images"`
	Translations       TVTranslationContainer `json:"translations"`
	LastEpisodeToAir   *struct {
		EpisodeNumber int `json:"episode_number"`
		SeasonNumber  int `json:"season_number"`
	} `json:"last_episode_to_air"`
	Success            *bool                `json:"success,omitempty"`
	StatusCode         *int                 `json:"status_code,omitempty"`
	StatusMessage      *string              `json:"status_message,omitempty"`
	RawSeasons         map[string]json.RawMessage `json:"-"`
}

// TVSeason models an appended season response (e.g. "season/1").
type TVSeason struct {
	SeasonNumber int         `json:"season_number"`
	Name         string      `json:"name"`
	Overview     string      `json:"overview"`
	AirDate      string      `json:"air_date"`
	PosterPath   string      `json:"poster_path"`
	Episodes     []TVEpisode `json:"episodes"`
}

// TVEpisode models an episode inside TVSeason.
type TVEpisode struct {
	ID             int          `json:"id"`
	EpisodeNumber  int          `json:"episode_number"`
	SeasonNumber   int          `json:"season_number"`
	Name           string       `json:"name"`
	Overview       string       `json:"overview"`
	AirDate        string       `json:"air_date"`
	StillPath      string       `json:"still_path"`
	VoteAverage    float64      `json:"vote_average"`
	EpisodeRunTime *int         `json:"episode_run_time,omitempty"`
	Runtime        *int         `json:"runtime,omitempty"`
	Crew           []PersonItem `json:"crew"`
}

type GenreItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type CountryItem struct {
	ISO3166_1 string `json:"iso_3166_1"`
	Name      string `json:"name"`
}

type PersonItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Job  string `json:"job,omitempty"`
}

type VideoContainer struct {
	Results []VideoItem `json:"results"`
}

type VideoItem struct {
	Name string `json:"name"`
	Key  string `json:"key"`
	Site string `json:"site"`
	Type string `json:"type"`
}

type CreditContainer struct {
	Cast []PersonItem `json:"cast"`
	Crew []PersonItem `json:"crew"`
}

type ImageContainer struct {
	Backdrops []ImageItem `json:"backdrops"`
	Posters   []ImageItem `json:"posters"`
}

type ImageItem struct {
	FilePath string  `json:"file_path"`
	ISO639_1 *string `json:"iso_639_1"`
}

type TranslationContainer struct {
	Translations []struct {
		ISO639_1 string `json:"iso_639_1"`
		Data     struct {
			Title    string `json:"title"`
			Overview string `json:"overview"`
		} `json:"data"`
	} `json:"translations"`
}

type TVTranslationContainer struct {
	Translations []struct {
		ISO639_1 string `json:"iso_639_1"`
		Data     struct {
			Name     string `json:"name"`
			Overview string `json:"overview"`
		} `json:"data"`
	} `json:"translations"`
}

// SearchResultItem models an item in movie/tv search results.
type SearchResultItem struct {
	ID   int    `json:"id"`
	Name string `json:"name,omitempty"`
	Title string `json:"title,omitempty"`
}

type SearchResponse struct {
	Page         int                `json:"page"`
	Results      []SearchResultItem `json:"results"`
	TotalResults int                `json:"total_results"`
}
