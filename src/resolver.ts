import { ScopeData, ScopeDataArgs, ScopeDataResolver, TemplateContent, TemplateData } from 'easy-template-x';
import { ResolveError } from './resolveError';
import { ResolverOptions } from './resolverOptions';
import { isNumber, isObject } from './utils';
const expressions = require('angular-expressions');
const getProp = require("lodash.get");

const undefinedResolver: ScopeDataResolver = () => undefined;

export class AngularResolver {

    private readonly options: ResolverOptions;
    private readonly fallback: ScopeDataResolver;

    constructor(options?: ResolverOptions) {
        this.options = new ResolverOptions(options);
        this.fallback = this.options.defaultFallback ? ScopeData.defaultResolver : undefinedResolver;

        // Configure 'angular-expressions' filters.
        for (const key of Object.keys(this.options.angularFilters || {})) {
            expressions.filters[key] = this.options.angularFilters[key];
        }
    }

    public resolve(args: ScopeDataArgs): TemplateContent | TemplateData[] {

        // Fallback on empty paths.
        if (!args.path.length) {
            return this.fallback(args);
        }

        // Fallback on number paths (generated by the loop plugin).
        const lastPart = args.path[args.path.length - 1];
        if (isNumber(lastPart)) {
            return this.fallback(args);
        }

        // Check required prefix.
        let exp = (lastPart?.name || "").trim();
        if (this.options.requiredPrefix && !exp.startsWith(this.options.requiredPrefix)) {
            return this.fallback(args);
        }
        if (this.options.requiredPrefix) {
            exp = exp.substr(this.options.requiredPrefix.length);
        }

        // Flatten the scope.
        const finalScope = Object.assign({}, args.data);
        let curScop: any = finalScope;
        for (const part of args.path) {
            const partIndexer = isNumber(part) ? part : part.name;

            // Apply the path filter.
            if (this.options.pathFilter && !this.options.pathFilter(partIndexer)) {
                continue;
            }
            // If it's not an object don't go deeper.
            curScop = getProp(curScop, partIndexer);
            if (!isObject(curScop)) {
                break;
            }
            Object.assign(finalScope, curScop);
        }

        // Resolve the expression.
        exp = exp.replace(/(’|‘)/g, "'").replace(/(“|”)/g, '"');
        try {
            return expressions.compile(exp)(finalScope);
        } catch (e) {
            throw new ResolveError(exp, args.strPath, e);
        }
    }
}
