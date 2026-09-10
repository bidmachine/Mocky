# Driving Mocky from a script or an agent

Mocky has no accounts and no registration. A mock is owned by a **secret you choose when you
create it** — whoever holds that secret can read, change and delete the mock. That is the whole
auth model, and it is what makes the service scriptable.

Everything below is plain HTTP against `/api`. Set `BASE` to the deployment you are using.

```bash
BASE=https://mocky.example.internal
```

> If the deployment sits behind basic auth at the edge, add `-u user:pass` to every call. That
> gate is separate from the mock secret.

## Create a mock

`secret` is yours to invent — treat it like a password you are generating, not a value to guess
later. Keep it for as long as you need the mock.

```bash
curl -s -X POST "$BASE/api/mock" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": 200,
    "content_type": "application/json",
    "charset": "UTF-8",
    "secret": "REPLACE-WITH-A-GENERATED-SECRET",
    "name": "checkout stub",
    "content": "{\"ok\":true}"
  }'
```

```json
{
  "id": "03c80343-…",
  "secret": "REPLACE-WITH-A-GENERATED-SECRET",
  "expireAt": "2026-09-24T10:11:12Z",
  "link": "https://mocky.example.internal/v3/03c80343-…"
}
```

`link` is ready to paste wherever the URL is needed. Requests to it return your `content` with
your `status`, `content_type` and headers, for any method and any path suffix — `link + /rtb`
serves the same mock.

### Fields

| Field | Required | Notes |
|---|---|---|
| `status` | yes | 100–999 |
| `content_type` | yes | e.g. `application/json` |
| `charset` | yes | e.g. `UTF-8` |
| `secret` | yes | you choose it; max 64 chars |
| `content` | no | the response body |
| `name` | no | label shown in the UI, max 100 chars |
| `headers` | no | flat object of string → string |
| `expiration` | no | `never`, `1day`, `1week`, `2weeks`, `1month`, `1year` |

### About `expiration`

**Omit it and the mock lives 2 weeks.** That default exists for exactly this use: a mock created
by a script is usually wanted for a test run, not forever, and an expired mock is deleted rather
than kept.

Pass `"expiration": "never"` only for a mock a person will keep using. Once it expires the URL
returns 404 and the row is removed — including its captured requests.

(The designer defaults to "never" instead, because a mock made there is kept in that browser's
list, along with the secret needed to delete it. Nothing remembers a mock created from a script,
which is why this default differs.)

## Capture requests sent to the mock

Off by default. Turn it on with the number of recent requests to keep (max 100):

```bash
curl -s -X POST "$BASE/api/mock/$ID/capture" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'","limit":100}'      # 204
```

Read what arrived — newest first:

```bash
curl -s -X POST "$BASE/api/mock/$ID/requests" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'","page":1,"per_page":50}'
```

Each item carries `method`, `path`, `query`, `headers`, `content_type`, `body`, `body_size`,
`truncated` and `received_at`. `body` is text when the payload was valid UTF-8 and base64
otherwise; `body_encoding` says which. Bodies over 64 KB are stored truncated, with
`truncated: true`.

Set `"limit": 0` to turn capture back off. Requests older than 7 days are dropped regardless.

## Read, update, delete

```bash
# read the definition (no secret needed)
curl -s "$BASE/api/mock/$ID"

# replace it — PUT sends the whole mock, not a patch
curl -s -X PUT "$BASE/api/mock/$ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":500,"content_type":"application/json","charset":"UTF-8",
       "secret":"'"$SECRET"'","content":"{\"error\":\"boom\"}"}'   # 204

# delete when finished
curl -s -X DELETE "$BASE/api/mock/$ID" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'"}'                                    # 204
```

Other endpoints: `POST /api/mock/$ID/requests/clear` empties the capture log,
`POST /api/mock/$ID/requests/delete` with `{"secret":…,"id":…}` removes one captured request,
`GET /api/mock/$ID/stats` returns call counts.

## A whole test run

```bash
SECRET=$(uuidgen)

CREATED=$(curl -s -X POST "$BASE/api/mock" -H 'Content-Type: application/json' \
  -d '{"status":200,"content_type":"application/json","charset":"UTF-8",
       "secret":"'"$SECRET"'","name":"bid response","content":"{\"seatbid\":[]}"}')

ID=$(echo "$CREATED"   | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
LINK=$(echo "$CREATED" | python3 -c 'import json,sys; print(json.load(sys.stdin)["link"])')

curl -s -X POST "$BASE/api/mock/$ID/capture" -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'","limit":100}'

# … point the system under test at $LINK, then inspect what it sent …

curl -s -X POST "$BASE/api/mock/$ID/requests" -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'"}'

curl -s -X DELETE "$BASE/api/mock/$ID" -H 'Content-Type: application/json' \
  -d '{"secret":"'"$SECRET"'"}'
```

Deleting at the end is the polite thing to do; the 2-week default is the safety net for when a
run dies before it gets there.

## Two things worth knowing

**A mock you create this way does not appear in the web UI.** `/manage` lists what *that browser*
created — it is local storage, not a server-side account. Keep the `id` and `secret` in your own
output if a person needs to open the mock later.

**A lost secret cannot be recovered.** Nobody can read, change or delete the mock without it;
only an admin can remove it. This is why the 2-week default matters — print the secret, or let
the mock expire.
