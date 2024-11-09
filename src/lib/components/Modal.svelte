<script>
    import { onDestroy } from "svelte";
    import { browser } from "$app/environment";

    let { showModal = $bindable(), title, content } = $props();

    function handleKeydown(event) {
        if (event.key === "Escape") {
            showModal = false;
        }
    }

    if (browser) {
        window.addEventListener("keydown", handleKeydown);
    }

    onDestroy(() => {
        if (browser) {
            window.removeEventListener("keydown", handleKeydown);
        }
    });
</script>

<div
    class="modal-backdrop"
    class:show={showModal}
    onclick={() => (showModal = false)}
    role="dialog"
>
    <div
        class="modal"
        role="alertdialog"
    >
        <div class="modal-header">
            <h3>{title}</h3>
        </div>
        <div class="modal-content">
            {@render content()}
        </div>
    </div>
</div>

<style lang="scss">
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease;

        &.show {
            opacity: 1;
            visibility: visible;
        }
    }

    .modal {
        background-color: var(--bg-primary);
        border-radius: $border-radius;
        padding: $spacing-md;
        min-width: 300px;
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        transform: scale(0.9);
        transition: transform 0.2s ease;

        .show & {
            transform: scale(1);
        }
    }

    .modal-header {
        margin-bottom: $spacing-md;
        padding-bottom: $spacing-sm;
        border-bottom: 1px solid var(--border-color);

        h3 {
            margin: 0;
            color: var(--text-primary);
        }
    }

    .modal-content {
        color: var(--text-primary);
    }
</style>
