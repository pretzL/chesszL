<script>
    import { onMount } from "svelte";

    let { trigger, children, align = "right", className = "" } = $props();
    
    let isOpen = $state(false);
    let dropdownRef;
    
    onMount(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef && !dropdownRef.contains(event.target)) {
                isOpen = false;
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    });
</script>

<div class="dropdown-container" bind:this={dropdownRef}>
    <button
        class="dropdown-trigger {className}"
        onclick={() => isOpen = !isOpen}
    >
        {@render trigger()}
        <span class="chevron">
            {#if isOpen}
                ▲
            {:else}
                ▼
            {/if}
        </span>
    </button>

    {#if isOpen}
        <div class="dropdown-content" class:right={align === "right"} class:left={align === "left"}>
            <div class="dropdown-items">
                {@render children()}
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    .dropdown-container {
        position: relative;
        display: inline-block;
    }

    .dropdown-trigger {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        padding: $spacing-sm $spacing-md;
        border-radius: $border-radius;
        border: 1px solid var(--border-color);
        background-color: var(--button-bg);
        color: var(--button-text);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
            background-color: var(--button-hover);
        }

        .chevron {
            font-size: 0.8em;
            margin-left: $spacing-sm;
        }
    }

    .dropdown-content {
        position: absolute;
        z-index: $z-dropdown;
        margin-top: $spacing-sm;
        min-width: 200px;
        background-color: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: $border-radius;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

        &.right {
            right: 0;
        }

        &.left {
            left: 0;
        }
    }

    .dropdown-items {
        padding: $spacing-sm 0;
    }
</style>