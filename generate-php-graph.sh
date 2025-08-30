#!/bin/bash

# 🔒 PHP Graph Generator
# Generates basic graph data from PHP files for security analysis

set -e

OUTPUT_FILE="php_graph.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Find all PHP files
find_php_files() {
    find . -name "*.php" \
        -not -path "./vendor/*" \
        -not -path "./node_modules/*" \
        -not -path "./.git/*" \
        -not -path "./storage/*" \
        -not -path "./bootstrap/cache/*" \
        -type f
}

# Extract classes from PHP files
extract_classes() {
    local file="$1"
    local relative_path="${file#./}"

    # Extract class definitions
    grep -n "^class \|^abstract class \|^final class " "$file" 2>/dev/null | while IFS=: read -r line_number line; do
        # Extract class name
        class_name=$(echo "$line" | sed -n 's/.*class \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
        if [ -n "$class_name" ]; then
            # Calculate connections (simplified)
            in_degree=$(grep -c "$class_name" "$file" 2>/dev/null || echo 0)
            out_degree=$(grep -c "new $class_name\|extends $class_name\|implements $class_name" "$file" 2>/dev/null || echo 0)

            cat << EOF
    {
      "id": "$class_name",
      "label": "$class_name",
      "type": "class",
      "file": "$relative_path",
      "line": $line_number,
      "in_degree": $in_degree,
      "out_degree": $out_degree
    },
EOF
        fi
    done
}

# Extract functions from PHP files
extract_functions() {
    local file="$1"
    local relative_path="${file#./}"

    # Extract function definitions (not methods)
    grep -n "^function " "$file" 2>/dev/null | while IFS=: read -r line_number line; do
        # Extract function name
        func_name=$(echo "$line" | sed -n 's/function \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
        if [ -n "$func_name" ]; then
            # Calculate connections (simplified)
            in_degree=$(grep -c "$func_name" "$file" 2>/dev/null || echo 0)
            out_degree=0  # Functions typically don't have outgoing connections in this context

            cat << EOF
    {
      "id": "$func_name",
      "label": "$func_name",
      "type": "function",
      "file": "$relative_path",
      "line": $line_number,
      "in_degree": $in_degree,
      "out_degree": $out_degree
    },
EOF
        fi
    done
}

# Extract methods from PHP files
extract_methods() {
    local file="$1"
    local relative_path="${file#./}"

    # Extract method definitions (inside classes)
    awk '
    BEGIN { in_class = 0; current_class = "" }
    /^class / { in_class = 1; current_class = $2; sub(/[{ ]*$/, "", current_class) }
    /^}/ { in_class = 0; current_class = "" }
    in_class && /^    public function |^    private function |^    protected function |^    function / {
        # Extract method name
        line = $0
        sub(/^    /, "", line)  # Remove indentation
        if (match(line, /function ([a-zA-Z_][a-zA-Z0-9_]*)/, arr)) {
            method_name = arr[1]
            print current_class "::" method_name
        }
    }
    ' "$file" 2>/dev/null | while IFS= read -r method_id; do
        if [ -n "$method_id" ]; then
            # Get line number
            line_number=$(grep -n "$method_id" "$file" | head -1 | cut -d: -f1 || echo 1)

            # Calculate connections (simplified)
            in_degree=$(grep -c "${method_id#*::}" "$file" 2>/dev/null || echo 0)
            out_degree=0

            cat << EOF
    {
      "id": "$method_id",
      "label": "${method_id#*::}",
      "type": "method",
      "file": "$relative_path",
      "line": $line_number,
      "in_degree": $in_degree,
      "out_degree": $out_degree
    },
EOF
        fi
    done
}

# Generate edges between components
generate_edges() {
    local php_files="$1"

    # Simple edge generation based on file analysis
    echo "$php_files" | while read -r file; do
        if [ -f "$file" ]; then
            # Find extends relationships
            grep -n "extends " "$file" 2>/dev/null | while IFS=: read -r line_number line; do
                parent_class=$(echo "$line" | sed -n 's/.*extends \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
                child_class=$(echo "$line" | sed -n 's/.*class \([a-zA-Z_][a-zA-Z0-9_]*\).*extends.*/\1/p')

                if [ -n "$parent_class" ] && [ -n "$child_class" ]; then
                    cat << EOF
    {
      "source": "$child_class",
      "target": "$parent_class",
      "type": "extends",
      "weight": 1
    },
EOF
                fi
            done

            # Find implements relationships
            grep -n "implements " "$file" 2>/dev/null | while IFS=: read -r line_number line; do
                interface=$(echo "$line" | sed -n 's/.*implements \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
                class=$(echo "$line" | sed -n 's/.*class \([a-zA-Z_][a-zA-Z0-9_]*\).*implements.*/\1/p')

                if [ -n "$interface" ] && [ -n "$class" ]; then
                    cat << EOF
    {
      "source": "$class",
      "target": "$interface",
      "type": "implements",
      "weight": 1
    },
EOF
                fi
            done

            # Find method calls (simplified)
            grep -n "->" "$file" 2>/dev/null | head -10 | while IFS=: read -r line_number line; do
                # This is a very basic extraction - in practice you'd need more sophisticated parsing
                if echo "$line" | grep -q "new "; then
                    class_name=$(echo "$line" | sed -n 's/.*new \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
                    if [ -n "$class_name" ]; then
                        cat << EOF
    {
      "source": "unknown",
      "target": "$class_name",
      "type": "instantiates",
      "weight": 1
    },
EOF
                    fi
                fi
            done
        fi
    done
}

# Main execution
main() {
    log_info "Generating PHP graph data for security analysis..."

    # Find PHP files
    PHP_FILES=$(find_php_files)

    if [ -z "$PHP_FILES" ]; then
        log_warning "No PHP files found in the current directory"
        # Create minimal graph
        cat > "$OUTPUT_FILE" << 'EOF'
{
  "nodes": [],
  "edges": [],
  "stats": {
    "total_nodes": 0,
    "total_edges": 0,
    "classes": 0,
    "methods": 0,
    "functions": 0
  }
}
EOF
        log_success "Created minimal graph file: $OUTPUT_FILE"
        return
    fi

    FILE_COUNT=$(echo "$PHP_FILES" | wc -l)
    log_info "Found $FILE_COUNT PHP files to analyze"

    # Start building the JSON
    {
        echo '{'
        echo '  "nodes": ['

        # Extract nodes from all PHP files
        FIRST_NODE=true
        echo "$PHP_FILES" | while read -r file; do
            if [ -f "$file" ]; then
                log_info "Analyzing: $file"

                # Extract classes
                while IFS= read -r class_json; do
                    if [ -n "$class_json" ] && [ "$class_json" != "null" ]; then
                        if [ "$FIRST_NODE" = true ]; then
                            FIRST_NODE=false
                        else
                            echo ","
                        fi
                        echo "$class_json"
                    fi
                done < <(extract_classes "$file")

                # Extract functions
                while IFS= read -r func_json; do
                    if [ -n "$func_json" ] && [ "$func_json" != "null" ]; then
                        if [ "$FIRST_NODE" = true ]; then
                            FIRST_NODE=false
                        else
                            echo ","
                        fi
                        echo "$func_json"
                    fi
                done < <(extract_functions "$file")

                # Extract methods
                while IFS= read -r method_json; do
                    if [ -n "$method_json" ] && [ "$method_json" != "null" ]; then
                        if [ "$FIRST_NODE" = true ]; then
                            FIRST_NODE=false
                        else
                            echo ","
                        fi
                        echo "$method_json"
                    fi
                done < <(extract_methods "$file")
            fi
        done

        echo '  ],'
        echo '  "edges": ['

        # Generate edges
        FIRST_EDGE=true
        while IFS= read -r edge_json; do
            if [ -n "$edge_json" ] && [ "$edge_json" != "null" ]; then
                if [ "$FIRST_EDGE" = true ]; then
                    FIRST_EDGE=false
                else
                    echo ","
                fi
                echo "$edge_json"
            fi
        done < <(generate_edges "$PHP_FILES")

        echo '  ],'

        # Calculate statistics
        NODE_COUNT=$(jq '.nodes | length' /dev/stdin <<< "$(cat /dev/stdin)")
        EDGE_COUNT=$(jq '.edges | length' /dev/stdin <<< "$(cat /dev/stdin)")

        cat << EOF
  "stats": {
    "total_nodes": $NODE_COUNT,
    "total_edges": $EDGE_COUNT,
    "classes": 0,
    "methods": 0,
    "functions": 0
  }
}
EOF

    } > "$OUTPUT_FILE"

    # Validate the generated JSON
    if jq empty "$OUTPUT_FILE" 2>/dev/null; then
        NODE_COUNT=$(jq '.nodes | length' "$OUTPUT_FILE")
        EDGE_COUNT=$(jq '.edges | length' "$OUTPUT_FILE")

        log_success "PHP graph generated successfully: $OUTPUT_FILE"
        echo ""
        echo "📊 Graph Statistics:"
        echo "   📁 PHP Files Analyzed: $FILE_COUNT"
        echo "   🔗 Nodes: $NODE_COUNT"
        echo "   ➡️  Edges: $EDGE_COUNT"
        echo ""

    else
        log_error "Generated graph file is not valid JSON"
        log_info "Showing first few lines of generated file:"
        head -20 "$OUTPUT_FILE"
        exit 1
    fi
}

# Run main function
main "$@"