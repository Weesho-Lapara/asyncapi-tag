from mkdocs.plugins import BasePlugin
from mkdocs.config import config_options
from mkdocs.structure.files import File
import os
import re
import json

class AsyncAPIPlugin(BasePlugin):

    config_scheme = (
        ('asyncapi_file', config_options.Type(str, default='schema.json')),
    )

    def on_files(self, files, config):
        """
        Add the AsyncAPI file to the MkDocs files structure.
        """
        asyncapi_file_path = self.config['asyncapi_file']

        file_path = os.path.join(config['docs_dir'], asyncapi_file_path)
        if os.path.exists(file_path):
            # Create a File object for the AsyncAPI file
            file = File(
                path=asyncapi_file_path,
                src_dir=config['docs_dir'],
                dest_dir=config['site_dir'],
                use_directory_urls=config['use_directory_urls']
            )
            files.append(file)
            print(f"Added AsyncAPI schema: {file_path}")
        else:
            print(f"Warning: The specified AsyncAPI file '{file_path}' does not exist.")
        
        return files

    def on_page_content(self, html, page, config, files):
        """
        Inject AsyncAPI viewer into the relevant HTML file after it is processed.
        """

        match = re.search(r'<asyncapi-tag\s+([^>]+)>', html)
        if match:
            # Extract the JSON string from the custom tag
            tag_content = match.group(1)
            attributes = dict(re.findall(r'(\w+)\s*=\s*"([^"]+)"', tag_content))
            try:
                # configuration for show property
                schema_path = os.path.join(config['docs_dir'],attributes.get('src', 'schema.json'))
                sidebar = attributes.get('sidebar', 'true').lower() == 'true'
                info = attributes.get('info', 'true').lower() == 'true'
                servers = attributes.get('servers', 'true').lower() == 'true'
                operations = attributes.get('operations', 'true').lower() == 'true'
                messages = attributes.get('messages', 'true').lower() == 'true'
                schemas = attributes.get('schemas', 'true').lower() == 'true'
                errors = attributes.get('errors', 'true').lower() == 'true'

                #configuration for expand property
                messageExamples = attributes.get('messageExamples', 'true').lower() == 'true'

                #configuration for sidebar property
                try:
                    showServers = attributes.get('showServers', 'byDefault') == 'byDefault'
                except:
                    print("Error: Invalid showServers attribute value in the asyncapi tag. Supported values include: byDefault, bySpecTags, byServerTags")

                try:
                    showOperations = attributes.get('showOperations', 'byDefault') == 'byDefault'
                except:
                    print("Error: Invalid showServers attribute value in the asyncapi tag. Supported values include: byDefault, bySpecTags, byOperationsTags")

                # configuration for parser options, publish label and subscribe label
                try:
                    parserOptions = attributes.get('parserOptions', 'null') == 'null'
                except:
                    print("Error: Invalid parserOptions attribute value in the asyncapi tag.")

                publishLabel = attributes.get('publishLabel', 'PUB') == 'PUB'
                subscribeLabel = attributes.get('subscribeLabel', 'SUB') == 'SUB'

                viewer_config = {"expand":{"messageExamples":messageExamples},"sidebar":{"showServers":showServers,"showOperations":showOperations},"parserOptions":parserOptions,"publishLabel":publishLabel,"subscribeLabel":subscribeLabel,"show": {"sidebar": sidebar, "info":info, "servers": servers, "operations":operations, "messages": messages, "schemas":schemas, "errors":errors}}
            except json.JSONDecodeError:
                print("Error: Invalid attribute in the asyncapi tag")
                return html
            
            asyncapi_viewer = f'''
            <div id="asyncapi"></div>
            <script src="https://unpkg.com/js-yaml@4.0.0/dist/js-yaml.min.js"></script>
            <script src="https://unpkg.com/@asyncapi/react-component@latest/browser/standalone/index.js"></script>
            <script>

                console.log('Initializing AsyncAPI Viewer...');
                
                const schemaPath = '{schema_path}'; 
                console.log('Fetching schema from:', schemaPath);

                // Fetch the schema file to ensure it is accessible
                fetch(schemaPath).then(response => {{
                    if (!response.ok) {{
                        throw new Error(`Failed to fetch schema. Status: ${{response.status}}`);
                    }}
                    return response.text();
                }}).then(schemaText => {{
                    
                    let schemaDoc;
                    // Check if the schema is in JSON or YAML format based on the file extension or content
                    if (schemaPath.endWith('.yaml') || (schemaPath.endWith('.yml') {{
                        // Parse YAML to JSON
                        schemaDoc = jsyaml.load(schemaText);
                        console.log('YAML schema parsed:', schemaDoc);
                    }} else {{
                        // Parse JSON
                        schemaDoc = JSON.parse(schemaText);
                        console.log('JSON schema parsed:', schemaDoc);
                    }}

                    console.log('Schema fetched successfully:', schemaDoc);
                    AsyncApiStandalone.render({{
                        schema: schemaDoc,
                        config: {json.dumps(viewer_config)}
                    }}, document.getElementById('asyncapi'));

                    console.log('AsyncAPI Viewer Initialized');

                }}).catch(error => {{
                    console.error('Error fetching or rendering AsyncAPI schema:', error);
                }});

            </script>
            '''
            # Inject the AsyncAPI viewer just before closing body tag
            html += asyncapi_viewer
        return html

