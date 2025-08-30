# PHP Code Graph Explorer

A powerful interactive visualization tool for exploring PHP code relationships and dependencies. Built as a Cloudflare Worker for serverless deployment.

## 🚀 Live Demo

Access the live application at: [https://floral-snow-8582.alpinresorts-com.workers.dev](https://floral-snow-8582.alpinresorts-com.workers.dev)

## 📋 Features

### Core Functionality
- **Interactive Graph Visualization**: Dynamic force-directed graph using D3.js
- **File Upload**: Drag & drop or click to upload `php_graph.json` files
- **Real-time Search**: Search nodes by name, ID, or type with instant filtering
- **Advanced Filtering**: Filter by node types (Classes, Methods, Functions)
- **Connection Depth Control**: Customize how many levels of connections to display
- **Node Management**: Add/remove nodes dynamically with visual feedback

### UI Components
- **Responsive Sidebar**: Resizable panel with comprehensive controls
- **Graph Controls**: Zoom, pan, fit-to-view, expand/cluster operations
- **Statistics Dashboard**: Real-time metrics (nodes, edges, depth)
- **Node Details**: Rich tooltips with file locations and connection counts
- **Search Results**: Dedicated search results panel with pagination
- **Children Explorer**: View direct connections of selected nodes

### Graph Features
- **Multiple Edge Types**: Visual distinction between extends, instantiates, static calls, and method calls
- **Node Coloring**: Color-coded nodes by type (classes, methods, functions)
- **Interactive Tooltips**: Detailed information on hover
- **Drag & Drop**: Move nodes around for better layout
- **Zoom & Pan**: Full navigation controls
- **Node Highlighting**: Click to center and highlight nodes

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Visualization**: D3.js v7.8.5
- **Backend**: Cloudflare Workers (serverless)
- **Deployment**: Cloudflare Pages/Workers
- **Styling**: Modern CSS with gradients and animations

## 📁 Project Structure

```
graph-vis/
├── worker.js          # Cloudflare Worker (main application)
├── index.html         # Local development version
├── php_graph.json     # Sample data file
├── anal.py           # Analysis script
├── graph_php.py      # PHP graph generation
├── js_graph.json     # Alternative data format
└── README.md         # This file
```

## 🚀 Getting Started

### Using the Live Version
1. Visit the live demo link above
2. Upload your `php_graph.json` file by dragging & dropping or clicking "Choose File"
3. Explore the interactive graph visualization
4. Use search, filters, and controls to navigate your code structure

### Local Development
1. Clone this repository
2. Open `index.html` in your browser
3. Upload a `php_graph.json` file to start exploring

### Cloudflare Worker Deployment
1. Copy `worker.js` content
2. Create a new Cloudflare Worker
3. Paste the code and deploy
4. Configure your domain's DNS to point to the worker

## 📊 Data Format

The application expects a JSON file with this structure:

```json
{
  "nodes": [
    {
      "id": "unique_identifier",
      "label": "Display Name",
      "type": "class|method|function",
      "file": "path/to/file.php",
      "line": 123,
      "in_degree": 5,
      "out_degree": 3
    }
  ],
  "edges": [
    {
      "source": "node_id_1",
      "target": "node_id_2",
      "type": "extends|instantiates|static_call|method_call",
      "weight": 1
    }
  ],
  "stats": {
    "total_nodes": 1500,
    "total_edges": 3200,
    "classes": 234,
    "methods": 876,
    "functions": 390
  }
}
```

## 🎯 Use Cases

- **Code Architecture Review**: Understand complex codebases at a glance
- **Dependency Analysis**: Identify tightly coupled components
- **Refactoring Planning**: Visualize impact of code changes
- **Documentation**: Generate visual representations of code structure
- **Onboarding**: Help new developers understand project architecture

## 🔧 Configuration

### Connection Depth
- **Depth**: How many levels of connections to show (0-5)
- **Connections per Level**: Maximum nodes to display at each level (1-10)

### Graph Controls
- **Clear**: Remove all nodes from view
- **Center**: Fit all nodes in viewport
- **Expand**: Increase spacing between nodes
- **Cluster**: Reduce spacing between nodes

## 🌟 Key Features Explained

### Smart Node Loading
- Automatically loads top 5 most connected classes on startup
- Dynamically adds connected nodes based on depth settings
- Prevents duplicate nodes and edges

### Advanced Search
- Real-time filtering as you type
- Multi-criteria search (name, ID, type)
- Filter by node type with visual indicators

### Interactive Exploration
- Click nodes to see their direct connections
- Double-click to center view on specific nodes
- Drag nodes to reorganize layout
- Hover for detailed information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the AlpinResorts infrastructure tools.

## 🆘 Troubleshooting

### Common Issues
- **522 Error**: Check DNS configuration points to Cloudflare
- **No Graph Display**: Ensure JSON file follows correct format
- **Slow Performance**: Reduce connection depth for large graphs
- **Missing Nodes**: Check file upload completed successfully

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the data format requirements
3. Test with the provided sample data

---

**Built with ❤️ for PHP developers exploring complex codebases**