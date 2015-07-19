NPM_BIN=$(CURDIR)/node_modules/.bin
export NPM_BIN

src_js := $(shell find src -type f -name "*.js")

MAKEFLAGS+=-j 4

all: node_modules \
	$(CURDIR)/src/ckeditor/dev/builder/release/ckeditor \
	$(CURDIR)/dist/ckeditor.js

clean:
	rm -rf $(CURDIR)/src/ckeditor/dev/builder/release/ckeditor
	rm -rf $(CURDIR)/dist/ckeditor.js

$(CURDIR)/src/ckeditor/dev/builder/release/ckeditor: $(src_js)
	$(CURDIR)/src/ckeditor/dev/builder/build.sh \
		--skip-omitted-in-build-config \
		--leave-js-unminified \
		--leave-css-unminified \
		--no-zip \
		--no-tar \
		--build-config $(CURDIR)/src/build-config.js
	touch $@

$(CURDIR)/dist/ckeditor.js: node_modules $(CURDIR)/src/ckeditor/dev/builder/release/ckeditor
	mkdir -p $(CURDIR)/dist
	$(NPM_BIN)/borschik -m no -i $(CURDIR)/src/ckeditor.js >> $@

#$(CURDIR)/dist/ckeditor: build_ckeditor
#	rm -rf $(CURDIR)/dist/ckeditor
#	cp -r $(CURDIR)/src/ckeditor/dev/builder/release/ckeditor $(CURDIR)/dist

.PHONY: all clean