# Configuration

Use a layered approach: a YAML file for structured, non-secret settings, a
`.env` file for local-dev secrets, and real environment variables for
everything in production. This is standard practice for Go services (the
same layering popular libraries like Viper implement) without pulling in a
large configuration framework — a small YAML library, a small dotenv
library, and `internal/config`'s own merge logic covers it.

Precedence, lowest to highest:

1. Defaults hard-coded in `internal/config`.
2. Values from the YAML file, if present.
3. Values from `.env`, if present.
4. Real environment variables (however they're set — shell export,
   `docker run -e`, a hosting platform's own config) — always win, even
   over a value `.env` also sets.

```yaml
# config.yaml — structural, non-secret settings only
port: "8080"
log_level: INFO
db:
  max_open_conns: 10
trust_proxy_headers: false
```

```dotenv
# .env — secrets and anything else you'd rather not export by hand locally
DATABASE_URL=postgres://user:password@localhost:5432/app
```

Both files are entirely optional and independently gitignored: a missing
file is not an error, since real environment variables alone must remain
sufficient to run the app (e.g. in a container with no file mounted).
`.env` does not get loaded into the real process environment (no
`os.Setenv`) — it's read into a plain map that only gets consulted when a
key isn't already set in the real environment, so a real env var can never
be silently shadowed by a stray `.env` file. Each file's own path is itself
configurable via an environment variable (`CONFIG_FILE`, defaulting to
`config.yaml`; `ENV_FILE`, defaulting to `.env`) — `ENV_FILE` must be a raw
environment variable, since resolving it *from* `.env` would be circular.

Check in a `config.example.yaml` and an `.env.example` documenting the
available keys in each; the real `config.yaml`/`.env` a deployment actually
uses are both gitignored.

**Never put secrets in the YAML file** — it may be committed to version
control or baked into a container image. `config.yaml` has no key for a
secret at all (not even absent-by-convention — the loader shouldn't
recognize a `database_url` YAML key in the first place, so one can't
accidentally end up there); `.env` is the file that's allowed to hold them,
precisely because it's understood project-wide as the one that's never
committed.

What belongs in the YAML file (non-secret, structural):

```text
port
log_level
db.max_open_conns
trust_proxy_headers
```

What belongs in `.env` or a real environment variable (secrets,
per-deployment endpoints):

```text
DATABASE_URL
```

Do not hard-code:

* Passwords
* API keys
* Tokens
* Private keys
* Production endpoints

Fail fast when required configuration is missing or invalid — whether that
requirement is unmet by the YAML file, `.env`, the real environment, or all
three.

Use small, well-maintained libraries rather than hand-rolling parsers — the
standard library has no YAML or dotenv support, so this is a case where a
dependency provides concrete value: `gopkg.in/yaml.v3` for the YAML file,
`github.com/joho/godotenv` for `.env` — specifically its `Read` function,
which parses into a plain map, not `Load`, which would mutate the real
process environment via `os.Setenv` and undermine the "real env always
wins, `.env` is never silently shadowed" guarantee above.
