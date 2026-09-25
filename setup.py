from setuptools import setup, find_packages

setup(
    name='mkdocs-asyncapi-tag-plugin',
    version='0.9.0',
    description='MkDocs plugin to embed AsyncAPI HTML viewer in your markdown file.',
    author='Weesho Lapara',
    author_email='support@weesholapara.com',
    url='https://github.com/Weesho-Lapara/mkdocs-asyncapi-tag-plugin',
    packages=find_packages(),
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    keywords=["mkdocs asyncapi", "asyncapi render markdown"],
    install_requires=[
        'mkdocs>=1.0.4',
        'beautifulsoup4>=4.6.0',
    ],
    entry_points={
        'mkdocs.plugins': [
            'asyncapi-tag = mkdocs_asyncapi_tag.mkdocs_asyncapi_plugin:AsyncAPIPlugin',
        ]
    },
    include_package_data=True
)
