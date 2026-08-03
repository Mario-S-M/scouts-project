#!/usr/bin/env bash
# Librería compartida para interactuar con GitHub Projects v2 vía GraphQL.
# Requiere: gh CLI autenticado (GH_TOKEN), y las variables OWNER y REPO definidas.
# Uso: source .github/scripts/gh-project-lib.sh

set -euo pipefail

PROJECT_TITLE="${PROJECT_TITLE:-Scouts CC - Scrum Board}"

gh_graphql() {
  gh api graphql "$@"
}

# Envía una query GraphQL con variables complejas (arrays/objetos) usando body JSON.
# Importante: `gh api graphql -F var=...` siempre envía el valor como string, incluso si
# es JSON válido. Con --input - se manda el body completo y las variables llegan tipadas.
gh_graphql_input() {
  local query="$1" vars_json="$2"
  jq -nc --arg q "$query" --argjson v "$vars_json" '{query:$q, variables:$v}' \
    | gh api graphql --input -
}

# Node ID del propietario del proyecto (usuario u organización).
gh_owner_id() {
  gh_graphql \
    -f query='query($login:String!){ user(login:$login){ id } }' \
    -F login="$OWNER" -q '.data.user.id'
}

# ID (node) del proyecto buscado por título.
gh_project_id() {
  gh_graphql \
    -f query='query($login:String!){ user(login:$login){ projectsV2(first:100){ nodes { id number title } } } }' \
    -F login="$OWNER" \
    | jq -r --arg t "$PROJECT_TITLE" '.data.user.projectsV2.nodes[]? | select(.title==$t) | .id' | head -1
}

# Número del proyecto buscado por título.
gh_project_number() {
  gh_graphql \
    -f query='query($login:String!){ user(login:$login){ projectsV2(first:100){ nodes { id number title } } } }' \
    -F login="$OWNER" \
    | jq -r --arg t "$PROJECT_TITLE" '.data.user.projectsV2.nodes[]? | select(.title==$t) | .number' | head -1
}

# JSON de un campo single-select del proyecto: { id, options: [{id,name,color,description}] }
gh_field_info() {
  gh_graphql \
    -f query='query($id:ID!,$name:String!){ node(id:$id){ ... on ProjectV2 { field(name:$name){ ... on ProjectV2SingleSelectField { id options { id name color description } } } } } }' \
    -F id="$PROJECT_ID" -F name="$1" \
    | jq -r '.data.node.field // empty'
}

# ID de un campo single-select del proyecto.
gh_single_select_field_id() {
  local info
  info="$(gh_field_info "$1" || true)"
  printf '%s' "$info" | jq -r '.id // empty'
}

# ID de una opción de un campo single-select (por nombre).
gh_select_option_id() {
  local field_name="$1" option_name="$2" info
  info="$(gh_field_info "$field_name" || true)"
  printf '%s' "$info" | jq -r --arg n "$option_name" '.options[]? | select(.name==$n) | .id' | head -1
}

# ID de una opción del campo "Status".
gh_status_option_id() {
  gh_select_option_id "Status" "$1"
}

# Añade una opción a un campo single-select si no existe. Devuelve el id de la opción.
gh_ensure_select_option() {
  local field_name="$1" option_name="$2" color="${3:-BLUE}" info field_id option_id new_opts
  info="$(gh_field_info "$field_name" || true)"
  field_id="$(printf '%s' "$info" | jq -r '.id // empty')"
  if [ -z "$field_id" ]; then
    echo "::error::El campo '$field_name' no existe en el proyecto." >&2
    return 1
  fi
  option_id="$(printf '%s' "$info" | jq -r --arg n "$option_name" '.options[]? | select(.name==$n) | .id' | head -1)"
  if [ -n "$option_id" ]; then
    printf '%s' "$option_id"
    return 0
  fi
  new_opts="$(printf '%s' "$info" | jq -c --arg n "$option_name" --arg c "$color" \
    '.options + [{name:$n, color:$c, description:""}]')"
  VARS="$(jq -nc --arg fid "$field_id" --argjson opts "$new_opts" '{fid:$fid, opts:$opts}')"
  gh_graphql_input \
    'mutation($fid:ID!,$opts:[ProjectV2SingleSelectFieldOptionInput!]!){ updateProjectV2Field(input:{fieldId:$fid, singleSelectOptions:$opts}){ projectV2Field{ ... on ProjectV2SingleSelectField { id } } } }' \
    "$VARS" >/dev/null
  gh_select_option_id "$field_name" "$option_name"
}

# Añade un contenido (issue) al proyecto y devuelve el item id.
# Documentación oficial: si el item ya existe, devuelve el id existente.
gh_add_item_to_project() {
  gh_graphql \
    -f query='mutation($pid:ID!,$cid:ID!){ addProjectV2ItemById(input:{projectId:$pid, contentId:$cid}){ item { id } } }' \
    -F pid="$PROJECT_ID" -F cid="$1" -q '.data.addProjectV2ItemById.item.id'
}

gh_ensure_item() {
  gh_add_item_to_project "$1"
}

# Cambia el valor de un campo single-select de un item del proyecto.
gh_set_item_select() {
  gh_graphql \
    -f query='mutation($pid:ID!,$iid:ID!,$fid:ID!,$oid:ID!){ updateProjectV2ItemFieldValue(input:{projectId:$pid, itemId:$iid, fieldId:$fid, value:{singleSelectOptionId:$oid}}){ projectV2Item { id } } }' \
    -F pid="$PROJECT_ID" -F iid="$1" -F fid="$2" -F oid="$3" >/dev/null
}

# Cambia el valor del campo Status de un item (requiere $STATUS_FIELD_ID definido).
gh_set_item_status() {
  gh_set_item_select "$1" "$STATUS_FIELD_ID" "$2"
}

# Extrae números de issues linkeados en el cuerpo de un PR
# (acepta "Closes #12", "Fixes: #12", URLs "issues/12", etc.)
gh_linked_issue_numbers() {
  {
    printf '%s' "$1" | grep -oiE '(close[sd]?|fix(e[sd])?|resolv(e[sd])?)[^0-9]*(#[0-9]+([ ,]+#?[0-9]+)*)' | grep -oE '#[0-9]+' | tr -d '#'
    printf '%s' "$1" | grep -oiE '(issues|pull)/[0-9]+' | grep -oE '[0-9]+'
  } | sort -un
}
